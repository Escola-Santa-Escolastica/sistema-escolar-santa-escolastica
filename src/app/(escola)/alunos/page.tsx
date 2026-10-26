import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { idadeEmAnos, STATUS_MATRICULA, type StatusMatricula } from '@/lib/formatos';
import { Avatar, SelosAlerta, Selo, alertasDe } from '@/components/ui';

export const metadata: Metadata = { title: 'Alunos' };

type Aluno = {
  id: string;
  pessoa: { nome: string; nome_social: string | null; data_nascimento: string | null };
  matriculas: { id: string; status: StatusMatricula; ano_letivo_id: string; turma: { id: string; nome: string } | null; etapa: { nome: string } }[];
};

export default async function Alunos({ searchParams }: { searchParams: Promise<{ turma?: string; busca?: string }> }) {
  await exigirSessao(['direcao', 'coordenacao', 'secretaria', 'professor_regente', 'professor_especialista', 'auxiliar']);
  const { turma, busca = '' } = await searchParams;
  const supabase = await criarClienteSupabase();
  const { data: ano } = await supabase.from('anos_letivos').select('id, ano').eq('ativo', true).maybeSingle();

  // A RLS já limita: professores e auxiliares só recebem os alunos das suas turmas.
  const { data } = await supabase
    .from('alunos')
    .select('id, pessoa:pessoas!inner(nome, nome_social, data_nascimento), matriculas(id, status, ano_letivo_id, turma:turmas(id, nome), etapa:etapas(nome))')
    .order('nome', { referencedTable: 'pessoas' });

  let alunos = ((data ?? []) as unknown as Aluno[]).map((a) => ({
    ...a,
    atual: a.matriculas.find((m) => m.ano_letivo_id === ano?.id && m.status !== 'cancelado') ?? null,
  }));
  if (turma) alunos = alunos.filter((a) => a.atual?.turma?.id === turma);
  const termo = busca.trim().toLowerCase();
  if (termo) alunos = alunos.filter((a) => `${a.pessoa.nome} ${a.pessoa.nome_social ?? ''}`.toLowerCase().includes(termo));
  alunos.sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, 'pt-BR'));

  const ids = alunos.map((a) => a.id);
  const { data: alertas } = ids.length
    ? await supabase.from('vw_alertas_aluno').select('*').in('aluno_id', ids)
    : { data: [] };
  const alertaDe = new Map((alertas ?? []).map((x) => [x.aluno_id as string, x]));
  const nomeTurma = turma ? alunos[0]?.atual?.turma?.nome : null;

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">{ano ? `Ano letivo ${ano.ano}` : ''}{nomeTurma ? ` · ${nomeTurma}` : ''}</p>
          <h1 className="titulo">Alunos</h1>
        </div>
        <form role="search" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {turma ? <input type="hidden" name="turma" value={turma} /> : null}
          <div className="se-campo">
            <label htmlFor="busca" className="se-campo-rotulo">Buscar aluno</label>
            <input id="busca" name="busca" defaultValue={busca} className="se-campo-input" placeholder="Nome" style={{ width: 240 }} />
          </div>
          <button type="submit" className="se-btn se-btn-secundario se-btn-md">Buscar</button>
        </form>
      </div>
      {turma ? <p style={{ margin: 0 }}><Link href="/alunos">Ver todos os alunos</Link></p> : null}

      <section className="painel painel-sem-padding">
        {alunos.length === 0 ? (
          <p className="vazio">Nenhum aluno encontrado.</p>
        ) : (
          <ul className="lista-linhas" style={{ padding: '0 20px' }}>
            {alunos.map((a) => {
              const al = alertaDe.get(a.id);
              const idade = idadeEmAnos(a.pessoa.data_nascimento);
              const nome = a.pessoa.nome_social || a.pessoa.nome;
              return (
                <li key={a.id}>
                  <Avatar nome={nome} />
                  <div className="cresce">
                    <Link href={`/alunos/${a.id}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{nome}</Link>
                    <div className="legenda">
                      {[a.atual?.etapa.nome, a.atual?.turma?.nome ?? (a.atual ? 'sem turma' : 'sem matrícula neste ano'), idade !== null ? `${idade} anos` : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <SelosAlerta alertas={alertasDe(al, al?.possui_laudo)} comDetalhe={false} />
                  {a.atual && a.atual.status !== 'matriculado' ? (
                    <Selo tom={STATUS_MATRICULA[a.atual.status].tom}>{STATUS_MATRICULA[a.atual.status].rotulo}</Selo>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="legenda" style={{ margin: 0 }}>{alunos.length} aluno{alunos.length === 1 ? '' : 's'}.</p>
    </main>
  );
}
