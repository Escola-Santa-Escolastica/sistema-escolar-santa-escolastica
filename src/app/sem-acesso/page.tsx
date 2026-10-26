import type { Metadata } from 'next';
import { sair } from '@/app/entrar/actions';
import { Botao, BotaoLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Sem acesso' };

export default function SemAcesso() {
  return (
    <main className="entrar">
      <div className="entrar-caixa">
        <div className="entrar-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema-completo.png" alt="Instituto Santa Escolástica" width={289} height={347} className="entrar-emblema" />
        </div>
        <div className="painel" style={{ display: 'grid', gap: 16 }}>
          <h1 className="secao-titulo">Sem acesso a esta área</h1>
          <p style={{ margin: 0 }}>
            Sua conta não tem um perfil liberado para esta página. Se você acha que deveria ter acesso, fale com a
            secretaria ou com a direção da escola.
          </p>
          <div className="acoes">
            <BotaoLink href="/">Voltar ao início</BotaoLink>
            <form action={sair}><Botao type="submit" variante="texto">Sair</Botao></form>
          </div>
        </div>
      </div>
    </main>
  );
}
