import type { Metadata } from 'next';
import { FormularioEntrar } from './formulario';
import { DURACAO_MAXIMA_H, INATIVIDADE_MIN } from '@/lib/limite-sessao';

export const metadata: Metadata = { title: 'Entrar' };

const AVISOS: Record<string, string> = {
  inatividade: `Por segurança, sua sessão terminou depois de ${INATIVIDADE_MIN} minutos sem uso. Entre de novo para continuar.`,
  tempo: `Por segurança, é preciso entrar de novo a cada ${DURACAO_MAXIMA_H} horas.`,
  link: 'O link do e-mail venceu ou já foi usado. Peça um novo em "Esqueci a senha / primeiro acesso".',
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ voltar?: string; expirou?: string; erro?: string }> }) {
  const { voltar, expirou, erro } = await searchParams;
  const aviso = AVISOS[expirou ?? ''] ?? AVISOS[erro ?? ''];
  return (
    <main className="entrar">
      <div className="entrar-caixa">
        <div className="entrar-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema-completo.png" alt="Instituto Santa Escolástica — Fé, Virtude, Sabedoria" width={289} height={347} className="entrar-emblema" />
        </div>
        <FormularioEntrar voltar={voltar} aviso={aviso} />
      </div>
    </main>
  );
}
