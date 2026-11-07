'use client';

import { useActionState } from 'react';
import { pedirVisita, type EstadoVisita } from '@/app/visita-actions';
import { Aviso, Botao } from '@/components/ui';
import { CampoTelefone } from '@/components/campo-mascara';

/** "Agende uma visita": funciona sem login. */
export function FormVisita() {
  const [estado, acao, enviando] = useActionState<EstadoVisita, FormData>(pedirVisita, {});
  if (estado.ok) {
    return (
      <div role="status" className="site-visita-ok">
        <strong>Recebemos seu contato!</strong>
        <span>A secretaria vai ligar para combinar a visita.</span>
      </div>
    );
  }
  return (
    <form action={acao} className="site-visita-form" noValidate>
      <h3>Quero conhecer a escola</h3>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <div className="se-campo">
        <label htmlFor="v-nome" className="se-campo-rotulo">Seu nome <span className="se-campo-obrig" aria-hidden="true">*</span></label>
        <input id="v-nome" name="nome" required autoComplete="name" className="se-campo-input" defaultValue={estado.valores?.nome} />
      </div>
      <CampoTelefone rotulo="Telefone ou WhatsApp" name="telefone" obrigatorio defaultValue={estado.valores?.telefone} />
      <div className="se-campo">
        <label htmlFor="v-idade" className="se-campo-rotulo">Idade da criança no próximo ano</label>
        <select id="v-idade" name="idade" className="se-campo-input" defaultValue="4 anos (Pré I)">
          <option>4 anos (Pré I)</option>
          <option>5 anos (Pré II)</option>
          <option>Outra idade</option>
        </select>
      </div>
      {/* campo-armadilha contra robôs: pessoas não veem */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="v-site">Não preencha</label>
        <input id="v-site" name="site" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="site-consentimento">
        <input type="checkbox" name="consentimento" />
        <span>Autorizo a escola a usar estes dados só para entrar em contato comigo sobre a visita.</span>
      </label>
      <Botao type="submit" variante="primario" larguraTotal disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</Botao>
    </form>
  );
}
