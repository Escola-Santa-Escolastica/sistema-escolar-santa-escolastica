import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterSessao } from '@/lib/sessao';
import { FormularioSenha } from './formulario';

export const metadata: Metadata = { title: 'Definir senha' };

export default async function DefinirSenha() {
  const sessao = await obterSessao();
  if (!sessao) redirect('/entrar');
  return (
    <main className="entrar">
      <div className="entrar-caixa">
        <div className="entrar-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema-completo.png" alt="Instituto Santa Escolástica — Fé, Virtude, Sabedoria" width={289} height={347} className="entrar-emblema" />
        </div>
        <FormularioSenha email={sessao.email} />
      </div>
    </main>
  );
}
