'use client';

import { useActionState, useState } from 'react';
import { convidarUsuario, type EstadoUsuario } from './actions';
import { Aviso, Botao, Campo, CampoSelect } from '@/components/ui';
import { PAPEIS_ATRIBUIVEIS, PAPEIS_COM_TURMA, ROTULO_PAPEL, type Papel } from '@/lib/perfis';

export function FormularioConvite({ turmas, componentes }: {
  turmas: { id: string; nome: string }[];
  componentes: { id: string; nome: string }[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoUsuario, FormData>(convidarUsuario, {});
  const [papel, setPapel] = useState<Papel>('professor_regente');

  return (
    <form action={acao} className="painel" style={{ display: 'grid', gap: 16 }}>
      <h2 className="secao-titulo">Convidar pessoa da equipe</h2>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <Campo rotulo="Nome completo" name="nome" autoComplete="off" obrigatorio />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="off" obrigatorio
        dica="A pessoa recebe um link para criar a própria senha." />
      <CampoSelect rotulo="Perfil" name="papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)} obrigatorio>
        {PAPEIS_ATRIBUIVEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
      </CampoSelect>
      {PAPEIS_COM_TURMA.includes(papel) ? (
        <CampoSelect rotulo="Turma" name="turma_id" obrigatorio defaultValue="">
          <option value="" disabled>Escolha a turma</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </CampoSelect>
      ) : null}
      {papel === 'professor_especialista' ? (
        <CampoSelect rotulo="Componente" name="componente_id" obrigatorio defaultValue="">
          <option value="" disabled>Escolha o componente</option>
          {componentes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </CampoSelect>
      ) : null}
      <Botao type="submit" variante="primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</Botao>
    </form>
  );
}
