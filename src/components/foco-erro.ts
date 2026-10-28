'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Quando o servidor devolve um erro com o nome do campo, leva a pessoa até ele:
 * rola a tela, coloca o cursor no campo e pinta a borda de vermelho até ela mexer.
 */
export function useFocoNoErro(form: RefObject<HTMLFormElement | null>, estado: { erro?: string; campo?: string }) {
  useEffect(() => {
    const raiz = form.current;
    if (!raiz) return;
    raiz.querySelectorAll('.se-campo-erro').forEach((el) => el.classList.remove('se-campo-erro'));
    if (!estado.erro) return;
    const alvo = estado.campo ? raiz.querySelector<HTMLElement>(`[name="${CSS.escape(estado.campo)}"]`) : null;
    if (!alvo) {
      raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const caixa = alvo.closest('.se-campo');
    caixa?.classList.add('se-campo-erro');
    alvo.setAttribute('aria-invalid', 'true');
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo.focus({ preventScroll: true });
    const limpar = () => {
      caixa?.classList.remove('se-campo-erro');
      alvo.removeAttribute('aria-invalid');
    };
    alvo.addEventListener('input', limpar, { once: true });
    alvo.addEventListener('change', limpar, { once: true });
    return () => {
      alvo.removeEventListener('input', limpar);
      alvo.removeEventListener('change', limpar);
    };
  }, [form, estado]);
}
