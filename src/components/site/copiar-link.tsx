'use client';

import { useState } from 'react';

export function BotaoCopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="site-btn site-btn-entrar"
      onClick={async () => {
        const alvo = url.startsWith('http') ? url : `${window.location.origin}${url}`;
        try { await navigator.clipboard.writeText(alvo); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem permissão */ }
      }}
    >
      <span aria-live="polite">{copiado ? 'Link copiado' : 'Copiar link'}</span>
    </button>
  );
}
