import type { Metadata } from 'next';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { sair } from '@/app/entrar/actions';
import { primeiroNome, STATUS_MATRICULA, TURNOS, type StatusMatricula, type Turno } from '@/lib/formatos';
import { Botao, CartaoAluno, Selo, alertasDe } from '@/components/ui';

export const metadata: Metadata = { title: 'Área da família' };

type Matricula = {
  id: string; aluno_id: string; aluno_nome: string; aluno_nome_social: string | null; status: StatusMatricula;
  etapa_nome: string; turma_nome: string | null; turno_pretendido: Turno; ano: number; documentos_pendentes: number;
};

/** Área da família: a RLS só devolve os filhos vinculados à conta. */
export default async function Familia() {
  const sessao = await exigirSessao(['responsavel']);
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.from('vw_matriculas')
    .select('id, aluno_id, aluno_nome, aluno_nome_social, status, etapa_nome, turma_nome, turno_pretendido, ano, documentos_pendentes')
    .neq('status', 'cancelado')
    .order('ano', { ascending: false });
  const matriculas = (data ?? []) as Matricula[];

  // Uma matrícula por criança (a mais recente).
  const porAluno = new Map<string, Matricula>();
  matriculas.forEach((m) => { if (!porAluno.has(m.aluno_id)) porAluno.set(m.aluno_id, m); });
  const filhos = [...porAluno.values()];

  const ids = filhos.map((f) => f.aluno_id);
  const matIds = filhos.map((f) => f.id);
  const [{ data: alertas }, { data: pendentes }] = await Promise.all([
    ids.length ? supabase.from('vw_alertas_aluno').select('*').in('aluno_id', ids) : Promise.resolve({ data: [] as never[] }),
    matIds.length
      ? supabase.from('documentos_entregues').select('matricula_id, status, tipo:tipos_documento(nome, obrigatorio)').in('matricula_id', matIds).eq('status', 'pendente')
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const alertaDe = new Map((alertas ?? []).map((a: { aluno_id: string }) => [a.aluno_id, a]));
  type Pend = { matricula_id: string; tipo: { nome: string; obrigatorio: boolean } };
  const pend = (pendentes ?? []) as unknown as Pend[];

  return (
    <>
      <header style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--line)' }}>
        <div className="pagina pagina-estreita" style={{ padding: '12px 24px', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema.png" alt="" width={40} height={42} />
          <span className="marca-nome" style={{ color: 'var(--azul)', fontSize: 16, flexGrow: 1 }}>Instituto Santa Escolástica</span>
          <form action={sair}><Botao type="submit" tamanho="sm" variante="texto">Sair</Botao></form>
        </div>
      </header>
      <main className="pagina pagina-estreita">
        <h1 className="titulo">Olá, {primeiroNome(sessao.nome)}</h1>
        {filhos.length === 0 ? (
          <p className="vazio">Ainda não há crianças vinculadas à sua conta. Fale com a secretaria da escola.</p>
        ) : filhos.map((f) => {
          const al = alertaDe.get(f.aluno_id) as Parameters<typeof alertasDe>[0] & { possui_laudo?: boolean } | undefined;
          const docs = pend.filter((p) => p.matricula_id === f.id && p.tipo.obrigatorio);
          return (
            <section key={f.aluno_id} style={{ display: 'grid', gap: 12 }} aria-label={f.aluno_nome_social || f.aluno_nome}>
              <CartaoAluno
                nome={f.aluno_nome_social || f.aluno_nome}
                meta={[f.etapa_nome, f.turma_nome ?? TURNOS[f.turno_pretendido], String(f.ano)].join(' · ')}
                alertas={alertasDe(al, al?.possui_laudo)}
              />
              <div className="painel" style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 className="secao-titulo" style={{ fontSize: 20 }}>Matrícula {f.ano}</h2>
                  <Selo tom={STATUS_MATRICULA[f.status].tom}>{STATUS_MATRICULA[f.status].rotulo}</Selo>
                </div>
                {docs.length > 0 && ['em_analise', 'pendente_documento'].includes(f.status) ? (
                  <div className="painel-dourado">
                    <strong>Falta entregar:</strong> {docs.map((d) => d.tipo.nome).join(', ')}. Leve à secretaria para concluirmos a matrícula.
                  </div>
                ) : null}
                {f.status === 'aguardando_aprovacao' ? <p style={{ margin: 0 }}>Os documentos estão completos. A direção vai aprovar a matrícula.</p> : null}
                {f.status === 'matriculado' && !f.turma_nome ? <p style={{ margin: 0 }}>Matrícula confirmada. A turma será informada em breve.</p> : null}
              </div>
            </section>
          );
        })}
        <p className="legenda" style={{ margin: 0 }}>
          Para corrigir algum dado (telefone, endereço, saúde), fale com a secretaria. Em breve você poderá fazer isso por aqui.
        </p>
      </main>
    </>
  );
}
