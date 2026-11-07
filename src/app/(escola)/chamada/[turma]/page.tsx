import { hojeNaEscola } from '@/lib/hoje';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, temAlgum } from '@/lib/perfis';
import { dataValida, ddmm, MOTIVOS, rotuloDia, type Motivo } from '@/lib/frequencia';
import { alertasDe } from '@/components/ui';
import { FormularioChamada, type AlunoChamada } from './formulario';

export const metadata: Metadata = { title: 'Chamada' };

type LinhaMatricula = { aluno: { id: string; pessoa: { nome: string } } };

export default async function Chamada({ params, searchParams }: {
  params: Promise<{ turma: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const sessao = await exigirSessao([...GESTAO, 'professor_regente']);
  const { turma: turmaId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(turmaId)) notFound();
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const hoje = await hojeNaEscola();
  const dia = eGestao ? (dataValida((await searchParams).data) ?? hoje) : hoje;

  const supabase = await criarClienteSupabase();
  const { data: turma } = await supabase.from('turmas').select('id, nome').eq('id', turmaId).maybeSingle();
  if (!turma) notFound();

  const { data: mats } = await supabase.from('matriculas')
    .select('aluno:alunos!inner(id, pessoa:pessoas!inner(nome))')
    .eq('turma_id', turmaId).eq('status', 'matriculado');
  const lista = ((mats ?? []) as unknown as LinhaMatricula[])
    .map((m) => ({ id: m.aluno.id, nome: m.aluno.pessoa.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ids = lista.map((a) => a.id);

  const [{ data: alertas }, { data: chamada }, { data: justificativas }, { data: bloqueio }] = await Promise.all([
    ids.length ? supabase.from('vw_alertas_aluno').select('*').in('aluno_id', ids) : Promise.resolve({ data: [] }),
    supabase.from('chamadas').select('id, registrada_em, atualizada_em').eq('turma_id', turmaId).eq('data', dia).maybeSingle(),
    ids.length
      ? supabase.from('justificativas_falta').select('aluno_id, motivo, observacao, aviso_previo, status').eq('data', dia).in('aluno_id', ids).neq('status', 'recusada')
      : Promise.resolve({ data: [] }),
    supabase.rpc('motivo_bloqueio_chamada', { p_turma: turmaId, p_data: dia }),
  ]);
  const { data: registros } = chamada
    ? await supabase.from('frequencias').select('aluno_id, situacao').eq('chamada_id', chamada.id)
    : { data: [] };

  const alertaDe = new Map((alertas ?? []).map((x) => [x.aluno_id as string, x]));
  const justDe = new Map((justificativas ?? []).map((j) => [j.aluno_id as string, j]));
  const alunos: AlunoChamada[] = lista.map((a) => {
    const al = alertaDe.get(a.id);
    const j = justDe.get(a.id);
    return {
      ...a,
      alertas: alertasDe(al, al?.possui_laudo).map((x) => x.tipo),
      aviso: j ? `${j.aviso_previo ? 'Aviso da família' : 'Justificativa'}: ${MOTIVOS[j.motivo as Motivo]}${j.observacao ? ` — ${j.observacao}` : ''}` : null,
    };
  });
  const faltasIniciais = chamada
    ? (registros ?? []).filter((r) => r.situacao === 'falta').map((r) => r.aluno_id as string)
    : (justificativas ?? []).filter((j) => j.aviso_previo).map((j) => j.aluno_id as string);
  const hora = (iso: string | null) => iso
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)).replace(':', 'h')
    : null;
  const nAvisos = (justificativas ?? []).filter((j) => j.aviso_previo).length;

  return (
    <main className="pagina pagina-estreita">
      <nav aria-label="Caminho" className="caminho">
        <Link href="/chamada">{eGestao ? 'Chamada das turmas' : 'Minhas turmas'}</Link> / {turma.nome}
      </nav>
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">Chamada de {rotuloDia(dia).toLowerCase()}{dia !== hoje ? '' : ' · hoje'}</p>
          <h1 className="titulo">{turma.nome}</h1>
        </div>
        {eGestao ? (
          <form className="busca" method="get">
            <div className="se-campo busca-campo">
              <label htmlFor="data" className="se-campo-rotulo">Dia</label>
              <input id="data" name="data" type="date" defaultValue={dia} max={hoje} className="se-campo-input" />
            </div>
            <button type="submit" className="se-btn se-btn-secundario se-btn-md">Abrir</button>
          </form>
        ) : null}
      </div>

      {nAvisos > 0 && !chamada ? (
        <div className="aviso aviso-info" role="note">
          <strong>{nAvisos === 1 ? '1 aviso da família' : `${nAvisos} avisos da família`} para {ddmm(dia)}.</strong>{' '}
          {nAvisos === 1 ? 'A criança já está marcada' : 'As crianças já estão marcadas'} com falta; confira e salve.
        </div>
      ) : null}

      <FormularioChamada
        turmaId={turmaId}
        dia={dia}
        alunos={alunos}
        faltasIniciais={faltasIniciais}
        bloqueio={(bloqueio as string | null) ?? null}
        salvaEm={hora(chamada?.atualizada_em ?? chamada?.registrada_em ?? null)}
        foiCorrigida={Boolean(chamada?.atualizada_em)}
        eGestao={eGestao}
      />
    </main>
  );
}
