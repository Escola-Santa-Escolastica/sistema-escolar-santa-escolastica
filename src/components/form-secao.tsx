'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Aviso, Botao } from '@/components/ui';
import { useFocoNoErro } from '@/components/foco-erro';

type Estado = { erro?: string; ok?: string; campo?: string };

/**
 * Formulário de uma seção da ficha, com mensagem de erro/sucesso.
 * Envia manualmente para o React não limpar os campos quando há erro.
 */
export function FormSecao({ titulo, acao, alunoId, rotuloBotao = 'Salvar', limparAoSalvar = false, children }: {
  titulo: string;
  acao: (estado: Estado, form: FormData) => Promise<Estado>;
  alunoId: string;
  rotuloBotao?: string;
  /** Esvazia os campos depois de salvar (ex.: adicionar outra pessoa), mantendo a mensagem. */
  limparAoSalvar?: boolean;
  children: ReactNode;
}) {
  const [estado, executar, enviando] = useActionState<Estado, FormData>(acao, {});
  const ref = useRef<HTMLFormElement>(null);
  useFocoNoErro(ref, estado);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (limparAoSalvar && estado.ok) setVersao((v) => v + 1);
  }, [estado, limparAoSalvar]);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => executar(dados));
  }

  return (
    <form ref={ref} onSubmit={enviar} noValidate className="painel" style={{ display: 'grid', gap: 16 }}>
      <h2 className="secao-titulo">{titulo}</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <input type="hidden" name="aluno_id" value={alunoId} />
      <div key={versao} className="form-grade">{children}</div>
      <div><Botao type="submit" variante="primario" disabled={enviando}>{enviando ? 'Salvando…' : rotuloBotao}</Botao></div>
    </form>
  );
}
