import type { Metadata } from 'next';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { criarClienteAdmin } from '@/lib/supabase/admin';
import { ROTULO_PAPEL, type Papel } from '@/lib/perfis';
import { Botao, Selo } from '@/components/ui';
import { alternarPerfil } from './actions';
import { FormularioConvite } from './formulario';

export const metadata: Metadata = { title: 'Usuários' };

type Linha = { id: string; user_id: string; papel: Papel; ativo: boolean; turma: { nome: string } | null; componente: { nome: string } | null };

export default async function Usuarios() {
  const sessao = await exigirSessao(['admin', 'direcao']);
  const eAdmin = sessao.papeis.includes('admin');
  const supabase = await criarClienteSupabase();

  const [{ data: atribuicoes }, { data: pessoas }, { data: turmas }, { data: componentes }] = await Promise.all([
    supabase.from('atribuicoes')
      .select('id, user_id, papel, ativo, turma:turmas(nome), componente:componentes(nome)')
      .neq('papel', 'responsavel')
      .order('created_at'),
    supabase.from('pessoas').select('user_id, nome').not('user_id', 'is', null),
    supabase.from('turmas').select('id, nome, ano_letivo:anos_letivos!inner(ativo)').eq('ano_letivo.ativo', true).order('nome'),
    supabase.from('componentes').select('id, nome').order('ordem'),
  ]);

  // E-mails vêm do serviço de autenticação (só o servidor tem acesso).
  const emails = new Map<string, string>();
  try {
    const { data } = await criarClienteAdmin().auth.admin.listUsers({ perPage: 1000 });
    data?.users.forEach((u) => emails.set(u.id, u.email ?? ''));
  } catch {
    // Sem a chave secreta configurada: a lista aparece sem e-mails.
  }
  const nomes = new Map((pessoas ?? []).map((p) => [p.user_id as string, p.nome]));
  const linhas = (atribuicoes ?? []) as unknown as Linha[];

  return (
    <main className="pagina">
      <div className="topo">
        <div className="topo-texto">
          <p className="topo-sub">Equipe da escola</p>
          <h1 className="titulo">Usuários e perfis</h1>
        </div>
      </div>
      <div className="colunas">
        <section className="painel painel-sem-padding coluna-principal" aria-labelledby="t-equipe">
          <div className="painel-cab"><h2 id="t-equipe" className="secao-titulo">Equipe</h2></div>
          {linhas.length === 0 ? <p className="vazio">Nenhum perfil cadastrado.</p> : (
            <div className="tabela-caixa">
              <table className="tabela">
                <thead><tr><th>Pessoa</th><th>Perfil</th><th>Escopo</th><th>Situação</th>{eAdmin ? <th><span className="sr-only">Ações</span></th> : null}</tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{nomes.get(l.user_id) ?? '—'}</div>
                        <div className="legenda">{emails.get(l.user_id) ?? ''}</div>
                      </td>
                      <td>{ROTULO_PAPEL[l.papel]}</td>
                      <td className="muted">{[l.turma?.nome, l.componente?.nome].filter(Boolean).join(' · ') || 'Escola toda'}</td>
                      <td><Selo tom={l.ativo ? 'verde' : 'neutro'}>{l.ativo ? 'Ativo' : 'Desativado'}</Selo></td>
                      {eAdmin ? (
                        <td>
                          {l.user_id === sessao.userId && l.papel === 'admin' ? null : (
                            <form action={alternarPerfil}>
                              <input type="hidden" name="id" value={l.id} />
                              <input type="hidden" name="ativo" value={String(l.ativo)} />
                              <Botao type="submit" tamanho="sm" variante={l.ativo ? 'perigo' : 'secundario'}>
                                {l.ativo ? 'Desativar' : 'Reativar'}
                              </Botao>
                            </form>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {eAdmin ? (
          <div className="coluna-lateral">
            <FormularioConvite turmas={(turmas ?? []).map((t) => ({ id: t.id, nome: t.nome }))} componentes={componentes ?? []} />
            <p className="legenda" style={{ margin: 0 }}>
              Contas de famílias são criadas pela secretaria, na ficha de cada aluno.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
