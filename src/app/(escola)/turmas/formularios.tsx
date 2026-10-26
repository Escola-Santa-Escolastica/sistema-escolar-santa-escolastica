'use client';

import { useActionState } from 'react';
import { criarAnoLetivo, criarTurma, type EstadoTurma } from './actions';
import { Aviso, Botao, Campo, CampoSelect } from '@/components/ui';
import { TURNOS } from '@/lib/formatos';

export function FormularioTurma({ etapas }: { etapas: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoTurma, FormData>(criarTurma, {});
  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 16 }}>
      <h2 className="secao-titulo">Nova turma</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <CampoSelect rotulo="Etapa" name="etapa_id" defaultValue="" obrigatorio>
        <option value="" disabled>Escolha</option>
        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </CampoSelect>
      <CampoSelect rotulo="Turno" name="turno" defaultValue="" obrigatorio>
        <option value="" disabled>Escolha</option>
        {Object.entries(TURNOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </CampoSelect>
      <Campo rotulo="Nome da turma" name="nome" dica="Em branco: etapa · turno (ex.: Pré II · Manhã)." />
      <Campo rotulo="Capacidade (vagas)" name="capacidade" type="number" min={1} max={60} defaultValue={20} obrigatorio />
      <Botao type="submit" variante="primario" disabled={enviando}>{enviando ? 'Criando…' : 'Criar turma'}</Botao>
    </form>
  );
}

export function FormularioAno() {
  const [estado, acao, enviando] = useActionState<EstadoTurma, FormData>(criarAnoLetivo, {});
  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 16 }}>
      <h2 className="secao-titulo">Novo ano letivo</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <Campo rotulo="Ano" name="ano" type="number" min={2024} max={2100} obrigatorio />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo rotulo="Início das aulas" name="inicio" type="date" />
        <Campo rotulo="Fim das aulas" name="fim" type="date" />
      </div>
      <Botao type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar ano letivo'}</Botao>
    </form>
  );
}
