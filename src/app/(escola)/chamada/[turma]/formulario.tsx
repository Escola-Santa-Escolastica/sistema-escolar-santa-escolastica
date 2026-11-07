'use client';

import { useState, useTransition } from 'react';
import { salvarChamada } from '../../frequencia/actions';
import { Aviso, Avatar, Botao, Selo } from '@/components/ui';

export type AlunoChamada = { id: string; nome: string; alertas: string[]; aviso: string | null };

const ROTULO_ALERTA: Record<string, string> = { alergia: 'Alergia', medicacao: 'Medicação', restricao: 'Restrição alimentar', laudo: 'Laudo' };

/**
 * Todos começam presentes; a professora toca em "Falta" em quem não veio.
 * Quem a família avisou que faltaria já vem marcado.
 */
export function FormularioChamada({ turmaId, dia, alunos, faltasIniciais, bloqueio, salvaEm, foiCorrigida, eGestao }: {
  turmaId: string;
  dia: string;
  alunos: AlunoChamada[];
  faltasIniciais: string[];
  bloqueio: string | null;
  salvaEm: string | null;
  foiCorrigida: boolean;
  eGestao: boolean;
}) {
  const [faltas, setFaltas] = useState(() => new Set(faltasIniciais));
  const [estado, setEstado] = useState<{ erro?: string; ok?: string }>({});
  const [salva, setSalva] = useState(Boolean(salvaEm));
  const [alterada, setAlterada] = useState(false);
  const [enviando, iniciar] = useTransition();

  function marcar(id: string, falta: boolean) {
    const n = new Set(faltas);
    if (falta) n.add(id); else n.delete(id);
    setFaltas(n);
    setAlterada(true);
    setEstado({});
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarChamada(turmaId, dia, [...faltas]);
      setEstado(r);
      if (r.ok) { setSalva(true); setAlterada(false); }
    });
  }

  const nFaltas = alunos.filter((a) => faltas.has(a.id)).length;
  const nPresentes = alunos.length - nFaltas;
  const somenteLeitura = Boolean(bloqueio);

  if (alunos.length === 0) {
    return <div className="painel"><p className="vazio">A turma ainda não tem alunos matriculados.</p></div>;
  }

  return (
    <>
      {bloqueio ? <Aviso tipo="info">{bloqueio}</Aviso> : null}
      <div className="chamada-resumo">
        <Selo tom="verde">{nPresentes} {nPresentes === 1 ? 'presente' : 'presentes'}</Selo>
        <Selo tom="falta">{nFaltas} {nFaltas === 1 ? 'falta' : 'faltas'}</Selo>
        <span className="legenda" style={{ marginLeft: 'auto' }}>
          {somenteLeitura ? `${alunos.length} alunos` : 'Toque em Falta em quem não veio'}
        </span>
      </div>

      <div className="chamada-lista">
        {alunos.map((a) => {
          const falta = faltas.has(a.id);
          return (
            <div key={a.id} className={`se-chamada${falta ? ' se-chamada-falta' : ''}`}>
              <div className="se-chamada-linha">
                <Avatar nome={a.nome} />
                <div className="se-chamada-corpo">
                  <span className="se-chamada-nome">{a.nome}</span>
                  {a.alertas.length ? (
                    <span className="se-chamada-alertas">
                      {a.alertas.map((t) => <Selo key={t} tom={t === 'laudo' ? 'dourado' : 'alerta'}>{ROTULO_ALERTA[t] ?? t}</Selo>)}
                    </span>
                  ) : null}
                </div>
                <div className="se-chamada-seletor" role="radiogroup" aria-label={`Frequência de ${a.nome}`}>
                  <button type="button" role="radio" aria-checked={!falta} disabled={somenteLeitura}
                    className={`se-chamada-op${!falta ? ' is-on' : ''}`} onClick={() => marcar(a.id, false)}>Presente</button>
                  <button type="button" role="radio" aria-checked={falta} disabled={somenteLeitura}
                    className={`se-chamada-op se-chamada-op-falta${falta ? ' is-on' : ''}`} onClick={() => marcar(a.id, true)}>Falta</button>
                </div>
              </div>
              {a.aviso ? <p className="se-chamada-aviso">{a.aviso}</p> : null}
            </div>
          );
        })}
      </div>

      {!somenteLeitura ? (
        <div className="rodape-form chamada-rodape">
          {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
          {estado.ok ? (
            <p role="status" className="chamada-ok">{estado.ok} {eGestao ? '' : 'Dá para corrigir até as 18h.'}</p>
          ) : salva && !alterada && salvaEm ? (
            <p role="status" className="chamada-ok">Chamada {foiCorrigida ? 'corrigida' : 'salva'} às {salvaEm}.</p>
          ) : null}
          <Botao variante={salva && !alterada ? 'secundario' : 'primario'} larguraTotal onClick={salvar} disabled={enviando}>
            {enviando ? 'Salvando…' : salva ? 'Salvar correção' : 'Salvar chamada'}
          </Botao>
        </div>
      ) : null}
    </>
  );
}
