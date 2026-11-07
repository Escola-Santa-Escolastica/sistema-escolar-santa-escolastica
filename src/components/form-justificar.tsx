'use client';

import { useActionState } from 'react';
import { Aviso, Botao } from '@/components/ui';
import { MOTIVOS } from '@/lib/frequencia';

type Estado = { erro?: string; ok?: string };

/**
 * Formulário de justificativa / aviso de falta. Serve à secretaria (ficha do
 * aluno) e à família; a ação decide o que acontece (ver registrar_justificativa).
 */
export function FormJustificar({ acao, alunoId, dia, escolherDia = false, minDia, rotuloBotao = 'Salvar justificativa', idPrefixo }: {
  acao: (estado: Estado, form: FormData) => Promise<Estado>;
  alunoId: string;
  dia?: string;
  escolherDia?: boolean;
  minDia?: string;
  rotuloBotao?: string;
  idPrefixo: string;
}) {
  const [estado, executar, enviando] = useActionState<Estado, FormData>(acao, {});
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={executar} className="form-justificar">
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <input type="hidden" name="aluno" value={alunoId} />
      {escolherDia ? (
        <div className="se-campo">
          <label htmlFor={`${idPrefixo}-dia`} className="se-campo-rotulo">Dia</label>
          <input id={`${idPrefixo}-dia`} name="dia" type="date" required min={minDia} defaultValue={dia} className="se-campo-input" />
        </div>
      ) : <input type="hidden" name="dia" value={dia} />}
      <div className="se-campo">
        <label htmlFor={`${idPrefixo}-motivo`} className="se-campo-rotulo">Motivo</label>
        <select id={`${idPrefixo}-motivo`} name="motivo" required defaultValue="" className="se-campo-input">
          <option value="" disabled>Escolha</option>
          {Object.entries(MOTIVOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <div className="se-campo">
        <label htmlFor={`${idPrefixo}-obs`} className="se-campo-rotulo">Recado (opcional)</label>
        <textarea id={`${idPrefixo}-obs`} name="observacao" rows={2} maxLength={500} className="se-campo-input se-campo-texto"
          placeholder="Ex.: consulta às 9h; atestado entregue na secretaria." />
      </div>
      <div className="acoes">
        <Botao type="submit" variante="primario" tamanho="sm" disabled={enviando}>{enviando ? 'Enviando…' : rotuloBotao}</Botao>
      </div>
    </form>
  );
}
