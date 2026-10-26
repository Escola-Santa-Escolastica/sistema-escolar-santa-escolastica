import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { GESTAO, PAPEIS_COM_TURMA, temAlgum } from '@/lib/perfis';
import { STATUS_EM_ANDAMENTO, STATUS_MATRICULA, type StatusMatricula } from '@/lib/formatos';
import { BotaoLink, Selo } from '@/components/ui';

export const metadata: Metadata = { title: 'Início' };

type LinhaMatricula = {
  id: string; numero: string; status: StatusMatricula; aluno_nome: string; etapa_nome: string;
  turno_pretendido: string; documentos_pendentes: number; updated_at: string;
};

const PROXIMO_PASSO: Partial<Record<StatusMatricula, string>> = {
  pre_matricula: 'Iniciar análise',
  em_analise: 'Conferir documentos',
  pendente_documento: 'Cobrar documento da família',
  aguardando_aprovacao: 'Aprovação da direção',
};

export default async function Inicio() {
  const sessao = await exigirSessao();
  const supabase = await criarClienteSupabase();
  const hoje = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(new Date());
  const { data: ano } = await supabase.from('anos_letivos').select('id, ano').eq('ativo', true).maybeSingle();
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const eProfessor = temAlgum(sessao.papeis, PAPEIS_COM_TURMA);

  let andamento: LinhaMatricula[] = [];
  let turmas: { id: string; nome: string; capacidade: number; ocupadas: number }[] = [];

  if (eGestao && ano) {
    const { data } = await supabase
      .from('vw_matriculas')
      .select('id, numero, status, aluno_nome, etapa_nome, turno_pretendido, documentos_pendentes, updated_at')
      .eq('ano_letivo_id', ano.id)
      .in('status', STATUS_EM_ANDAMENTO)
      .order('updated_at', { ascending: false })
      .limit(10);
    andamento = (data ?? []) as LinhaMatricula[];
  }

  if ((eGestao || eProfessor) && ano) {
    const minhasTurmas = sessao.atribuicoes.map((a) => a.turma_id).filter(Boolean) as string[];
    let consulta = supabase.from('turmas').select('id, nome, capacidade').eq('ano_letivo_id', ano.id).order('nome');
    if (!eGestao) consulta = consulta.in('id', minhasTurmas.length ? minhasTurmas : ['00000000-0000-0000-0000-000000000000']);
    const [{ data: ts }, { data: ms }] = await Promise.all([
      consulta,
      supabase.from('matriculas').select('turma_id').eq('ano_letivo_id', ano.id).eq('status', 'matriculado').not('turma_id', 'is', null),
    ]);
    turmas = (ts ?? []).map((t) => ({
      ...t,
      ocupadas: (ms ?? []).filter((m) => m.turma_id === t.id).length,
    }));
  }

  const aguardandoDirecao = andamento.filter((m) => m.status === 'aguardando_aprovacao').length;

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">
            {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
            {ano ? ` · Ano letivo ${ano.ano}` : ''}
          </p>
          <h1 className="titulo">Início</h1>
        </div>
        {temAlgum(sessao.papeis, ['secretaria']) ? (
          <BotaoLink href="/matriculas/nova" variante="primario">Nova matrícula</BotaoLink>
        ) : null}
      </div>

      {!ano && eGestao ? (
        <div className="painel-dourado">
          <strong>Nenhum ano letivo ativo.</strong> Cadastre ou ative um ano letivo em Turmas para começar as matrículas.
        </div>
      ) : null}

      {sessao.papeis.includes('direcao') && aguardandoDirecao > 0 ? (
        <div className="painel-dourado">
          <strong>{aguardandoDirecao === 1 ? '1 matrícula aguarda' : `${aguardandoDirecao} matrículas aguardam`} sua aprovação.</strong>{' '}
          <Link href="/matriculas?status=aguardando_aprovacao">Ver matrículas</Link>
        </div>
      ) : null}

      <div className="colunas">
        {eGestao ? (
          <section className="painel painel-sem-padding coluna-principal" aria-labelledby="t-andamento">
            <div className="painel-cab">
              <h2 id="t-andamento" className="secao-titulo">Matrículas em andamento</h2>
              <Link href="/matriculas" style={{ fontWeight: 600, fontSize: 14 }}>Ver todas</Link>
            </div>
            {andamento.length === 0 ? (
              <p className="vazio">Nenhuma matrícula em andamento.</p>
            ) : (
              <div className="tabela-caixa">
                <table className="tabela">
                  <thead><tr><th>Aluno</th><th>Etapa</th><th>Situação</th><th>Próximo passo</th></tr></thead>
                  <tbody>
                    {andamento.map((m) => (
                      <tr key={m.id}>
                        <td><Link className="nome" href={`/matriculas/${m.id}`}>{m.aluno_nome}</Link></td>
                        <td>{m.etapa_nome}</td>
                        <td><Selo tom={STATUS_MATRICULA[m.status].tom}>{STATUS_MATRICULA[m.status].rotulo}</Selo></td>
                        <td className="muted">
                          {m.status === 'em_analise' && m.documentos_pendentes > 0
                            ? `${m.documentos_pendentes} documento(s) pendente(s)`
                            : PROXIMO_PASSO[m.status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {turmas.length > 0 ? (
          <section className="painel coluna-lateral" aria-labelledby="t-turmas">
            <h2 id="t-turmas" className="secao-titulo" style={{ marginBottom: 12 }}>
              {eGestao ? 'Turmas' : 'Minhas turmas'}
            </h2>
            <ul className="lista-linhas">
              {turmas.map((t) => (
                <li key={t.id}>
                  <span className="cresce">
                    <Link href={`/alunos?turma=${t.id}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>{t.nome}</Link>
                  </span>
                  <Selo tom={t.ocupadas >= t.capacidade ? 'dourado' : 'neutro'}>
                    {t.ocupadas} de {t.capacidade} vagas
                  </Selo>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {sessao.papeis.includes('admin') && !eGestao ? (
        <section className="painel">
          <h2 className="secao-titulo" style={{ marginBottom: 8 }}>Administração</h2>
          <p style={{ marginTop: 0 }}>
            O perfil de administrador gerencia contas e perfis, sem acesso aos dados das crianças.
          </p>
          <BotaoLink href="/usuarios">Gerenciar usuários</BotaoLink>
        </section>
      ) : null}

      {eProfessor && turmas.length === 0 ? (
        <p className="vazio">Você ainda não foi atribuído(a) a nenhuma turma deste ano letivo.</p>
      ) : null}
    </main>
  );
}
