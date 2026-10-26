'use client';

import { useActionState } from 'react';
import { definirSenha, type EstadoSenha } from './actions';
import { Aviso, Botao, Campo } from '@/components/ui';

export function FormularioSenha({ email }: { email: string }) {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(definirSenha, {});
  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 16 }}>
      <h1 className="secao-titulo">Defina sua senha</h1>
      <p className="legenda" style={{ margin: 0 }}>Conta: {email}</p>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <Campo rotulo="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={10}
        dica="Pelo menos 10 caracteres." obrigatorio />
      <Campo rotulo="Repita a senha" name="confirmacao" type="password" autoComplete="new-password" obrigatorio />
      <Botao type="submit" variante="primario" larguraTotal disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar senha'}
      </Botao>
    </form>
  );
}
