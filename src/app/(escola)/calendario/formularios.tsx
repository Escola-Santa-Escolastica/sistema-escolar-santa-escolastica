'use client';

import { useActionState } from 'react';
import { adicionarData, salvarDatasDoAno, type EstadoFreq } from '../frequencia/actions';
import { Aviso, Botao } from '@/components/ui';
import { TIPOS_DIA } from '@/lib/frequencia';

export function FormDatasDoAno({ anoId, ano, inicio, fim }: { anoId: string; ano: number; inicio: string | null; fim: string | null }) {
  const [estado, acao, enviando] = useActionState<EstadoFreq, FormData>(salvarDatasDoAno, {});
  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 12 }}>
      <h2 className="secao-titulo">Período das aulas</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <input type="hidden" name="ano" value={anoId} />
      <div className="lado-a-lado">
        <div className="se-campo">
          <label htmlFor="inicio" className="se-campo-rotulo">Início das aulas</label>
          <input id="inicio" name="inicio" type="date" required defaultValue={inicio ?? `${ano}-02-01`} className="se-campo-input" />
        </div>
        <div className="se-campo">
          <label htmlFor="fim" className="se-campo-rotulo">Fim das aulas</label>
          <input id="fim" name="fim" type="date" required defaultValue={fim ?? `${ano}-12-10`} className="se-campo-input" />
        </div>
      </div>
      <div className="acoes"><Botao type="submit" tamanho="sm" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar período'}</Botao></div>
    </form>
  );
}

export function FormAdicionarData({ anoId }: { anoId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoFreq, FormData>(adicionarData, {});
  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 12 }}>
      <h2 className="secao-titulo">Adicionar data</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <input type="hidden" name="ano" value={anoId} />
      <div className="lado-a-lado">
        <div className="se-campo">
          <label htmlFor="de" className="se-campo-rotulo">Dia (ou início)</label>
          <input id="de" name="de" type="date" required className="se-campo-input" />
        </div>
        <div className="se-campo">
          <label htmlFor="ate" className="se-campo-rotulo">Até (opcional)</label>
          <input id="ate" name="ate" type="date" className="se-campo-input" />
        </div>
      </div>
      <div className="se-campo">
        <label htmlFor="tipo" className="se-campo-rotulo">Tipo</label>
        <select id="tipo" name="tipo" required defaultValue="feriado" className="se-campo-input">
          {Object.entries(TIPOS_DIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      <div className="se-campo">
        <label htmlFor="descricao" className="se-campo-rotulo">Descrição</label>
        <input id="descricao" name="descricao" required maxLength={80} placeholder="Ex.: Aniversário de Itapecerica" className="se-campo-input" />
      </div>
      <div className="acoes"><Botao type="submit" variante="primario" tamanho="sm" disabled={enviando}>{enviando ? 'Salvando…' : 'Adicionar'}</Botao></div>
    </form>
  );
}
