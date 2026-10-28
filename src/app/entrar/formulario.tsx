'use client';

import { useActionState, useState } from 'react';
import { entrar, enviarLinkSenha, type EstadoEntrar } from './actions';
import { Aviso, Botao, Campo } from '@/components/ui';

export function FormularioEntrar({ voltar, aviso }: { voltar?: string; aviso?: string }) {
  const [esqueci, setEsqueci] = useState(false);
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});
  const [estadoLink, acaoLink, enviandoLink] = useActionState<EstadoEntrar, FormData>(enviarLinkSenha, {});

  if (esqueci) {
    return (
      <form action={acaoLink} className="painel" style={{ display: 'grid', gap: 16 }}>
        <h1 className="secao-titulo">Criar ou trocar a senha</h1>
        {estadoLink.email === 'enviado' ? (
          <Aviso tipo="ok">Se o e-mail tiver acesso ao sistema, enviamos um link para definir a senha.</Aviso>
        ) : null}
        {estadoLink.erro ? <Aviso tipo="erro">{estadoLink.erro}</Aviso> : null}
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" obrigatorio />
        <Botao type="submit" variante="primario" larguraTotal disabled={enviandoLink}>
          {enviandoLink ? 'Enviando…' : 'Enviar link'}
        </Botao>
        <Botao variante="texto" onClick={() => setEsqueci(false)}>Voltar para a entrada</Botao>
      </form>
    );
  }

  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 16 }}>
      <h1 className="secao-titulo">Entrar</h1>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : aviso ? <Aviso tipo="info">{aviso}</Aviso> : null}
      <input type="hidden" name="voltar" value={voltar ?? ''} />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" defaultValue={estado.email} obrigatorio />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" obrigatorio />
      <Botao type="submit" variante="primario" larguraTotal disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </Botao>
      <Botao variante="texto" onClick={() => setEsqueci(true)}>Esqueci a senha / primeiro acesso</Botao>
    </form>
  );
}
