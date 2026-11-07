import Link from 'next/link';
import { sair } from '@/app/entrar/actions';
import { Botao } from '@/components/ui';

/** Topo simples da área da família (celular em primeiro lugar). */
export function CabecalhoFamilia() {
  return (
    <header style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--line)' }}>
      <div className="pagina pagina-estreita" style={{ padding: '12px 24px', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Link href="/familia" style={{ display: 'flex', alignItems: 'center', gap: 12, flexGrow: 1, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema.png" alt="" width={40} height={42} />
          <span className="marca-nome" style={{ color: 'var(--azul)', fontSize: 16 }}>Instituto Santa Escolástica</span>
        </Link>
        <form action={sair}><Botao type="submit" tamanho="sm" variante="texto">Sair</Botao></form>
      </div>
    </header>
  );
}
