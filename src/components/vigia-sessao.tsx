'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AVISO_ANTES_MS, INATIVIDADE_MIN, INATIVIDADE_MS } from '@/lib/limite-sessao';

const RENOVAR_A_CADA_MS = 4 * 60_000;
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

function sairPor(motivo: string) {
  const voltar = window.location.pathname;
  window.location.href = `/entrar?expirou=${motivo}${voltar && voltar !== '/' ? `&voltar=${encodeURIComponent(voltar)}` : ''}`;
}

/**
 * Cuida da sessão enquanto a página está aberta:
 * - quem está mexendo na tela (digitando uma ficha longa, por exemplo) continua conectado;
 * - sem uso, avisa 2 minutos antes e depois fecha a tela, para os dados não ficarem expostos.
 */
export function VigiaSessao() {
  const ultimoUso = useRef(Date.now());
  const ultimaRenovacao = useRef(Date.now());
  const [segundos, setSegundos] = useState<number | null>(null);

  const renovar = useCallback(async () => {
    ultimaRenovacao.current = Date.now();
    try {
      const r = await fetch('/api/sessao', { method: 'POST', cache: 'no-store' });
      if (r.status === 401) {
        const j = await r.json().catch(() => ({}));
        sairPor(j.motivo ?? 'inatividade');
      }
    } catch {
      // sem internet: tenta de novo no próximo uso
    }
  }, []);

  useEffect(() => {
    const usou = () => {
      ultimoUso.current = Date.now();
      if (Date.now() - ultimaRenovacao.current > RENOVAR_A_CADA_MS) void renovar();
    };
    EVENTOS.forEach((e) => window.addEventListener(e, usou, { passive: true }));

    const relogio = window.setInterval(async () => {
      const parado = Date.now() - ultimoUso.current;
      if (parado < INATIVIDADE_MS - AVISO_ANTES_MS) {
        setSegundos(null);
        return;
      }
      if (parado < INATIVIDADE_MS) {
        setSegundos(Math.ceil((INATIVIDADE_MS - parado) / 1000));
        return;
      }
      // O tempo acabou aqui; confere no servidor (outra aba pode ter usado o sistema).
      try {
        const r = await fetch('/api/sessao', { cache: 'no-store' });
        if (r.status === 401) {
          const j = await r.json().catch(() => ({}));
          sairPor(j.motivo ?? 'inatividade');
          return;
        }
        const j = await r.json();
        ultimoUso.current = Date.now() - (INATIVIDADE_MS - j.restanteMs);
        setSegundos(null);
      } catch {
        sairPor('inatividade');
      }
    }, 1000);

    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, usou));
      window.clearInterval(relogio);
    };
  }, [renovar]);

  if (segundos === null) return null;
  const min = Math.floor(segundos / 60);
  const seg = String(segundos % 60).padStart(2, '0');
  return (
    <div role="alertdialog" aria-live="assertive" aria-labelledby="aviso-sessao-titulo" className="aviso-sessao">
      <p id="aviso-sessao-titulo" style={{ margin: 0 }}>
        <strong>Sua sessão vai terminar em {min}:{seg}.</strong> Por segurança, o sistema sai sozinho depois de{' '}
        {INATIVIDADE_MIN} minutos sem uso.
      </p>
      <button type="button" className="se-btn se-btn-primario se-btn-md" onClick={() => { ultimoUso.current = Date.now(); setSegundos(null); void renovar(); }}>
        Continuar conectado
      </button>
    </div>
  );
}
