import { redirect } from 'next/navigation';
import { obterSessao } from '@/lib/sessao';
import { eSoFamilia } from '@/lib/perfis';

export default async function Raiz() {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  redirect(eSoFamilia(sessao.papeis) ? '/familia' : '/inicio');
}
