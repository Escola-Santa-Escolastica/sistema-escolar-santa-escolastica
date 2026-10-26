import { redirect } from 'next/navigation';
import { Cabecalho } from '@/components/cabecalho';
import { sair } from '@/app/entrar/actions';
import { exigirSessao } from '@/lib/sessao';
import { eSoFamilia, menuDoUsuario, ROTULO_PAPEL } from '@/lib/perfis';
import { primeiroNome } from '@/lib/formatos';

export default async function LayoutEscola({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  if (sessao.papeis.length === 0) redirect('/sem-acesso');
  if (eSoFamilia(sessao.papeis)) redirect('/familia');

  const menu = menuDoUsuario(sessao.papeis).map(({ href, rotulo }) => ({ href, rotulo }));
  const perfil = sessao.papeis
    .filter((p) => p !== 'responsavel')
    .map((p) => ROTULO_PAPEL[p])
    .join(', ');

  return (
    <>
      <Cabecalho menu={menu} nome={primeiroNome(sessao.nome)} perfil={perfil} acaoSair={sair} />
      {children}
    </>
  );
}
