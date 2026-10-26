import type { Metadata } from 'next';
import { FormularioEntrar } from './formulario';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar } = await searchParams;
  return (
    <main className="entrar">
      <div className="entrar-caixa">
        <div className="entrar-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema-completo.png" alt="Instituto Santa Escolástica — Fé, Virtude, Sabedoria" width={289} height={347} className="entrar-emblema" />
        </div>
        <FormularioEntrar voltar={voltar} />
      </div>
    </main>
  );
}
