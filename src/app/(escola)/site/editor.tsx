'use client';

import { useActionState, useState } from 'react';
import { salvarPublicacao, type EstadoPublicacao } from './actions';
import { Aviso, Selo } from '@/components/ui';
import { TIPO_PUBLICACAO, VISIBILIDADE, dataPorExtenso, diaMes, hora, type Publicacao, type TipoPublicacao, type Visibilidade } from '@/lib/site';

type Inicial = Partial<Pick<Publicacao, 'id' | 'tipo' | 'titulo' | 'resumo' | 'texto' | 'evento_data' | 'evento_inicio' | 'evento_fim' | 'evento_local' | 'visibilidade' | 'turma_id' | 'status'>>;

const DICAS: Record<TipoPublicacao, string> = {
  noticia: 'Algo que aconteceu ou um projeto das turmas.',
  evento: 'Tem data: aparece na agenda do site.',
  comunicado: 'Aviso curto e direto para as famílias.',
};

function hhmm(t?: string | null) {
  return t ? t.slice(0, 5) : '';
}

export function EditorPublicacao({ inicial, turmas, podePublicar, bloqueada }: {
  inicial?: Inicial;
  turmas: { id: string; nome: string }[];
  podePublicar: boolean;
  /** Publicação no ar que este perfil não pode alterar. */
  bloqueada?: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoPublicacao, FormData>(salvarPublicacao, {});
  const [tipo, setTipo] = useState<TipoPublicacao>(inicial?.tipo ?? 'noticia');
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [resumo, setResumo] = useState(inicial?.resumo ?? '');
  const [texto, setTexto] = useState(inicial?.texto ?? '');
  const [evData, setEvData] = useState(inicial?.evento_data ?? '');
  const [evIni, setEvIni] = useState(hhmm(inicial?.evento_inicio));
  const [evFim, setEvFim] = useState(hhmm(inicial?.evento_fim));
  const [evLocal, setEvLocal] = useState(inicial?.evento_local ?? '');
  const [vis, setVis] = useState<Visibilidade>(inicial?.visibilidade ?? 'publico');
  const [turma, setTurma] = useState(inicial?.turma_id ?? '');
  const [agendar, setAgendar] = useState(false);
  // Depois que a pessoa mexe no formulário, a mensagem de erro anterior some.
  const [visto, setVisto] = useState<EstadoPublicacao | null>(null);
  const erro = estado !== visto ? estado.erro : undefined;

  const erroEm = (campo: string) => (erro && estado.campo === campo ? erro : undefined);
  const t = TIPO_PUBLICACAO[tipo];
  const dm = tipo === 'evento' && evData ? diaMes(evData) : null;
  const horario = [hora(evIni || null), hora(evFim || null)].filter(Boolean).join(' às ');
  const paragrafos = texto.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).slice(0, 2);
  const nomeTurma = turmas.find((x) => x.id === turma)?.nome;

  return (
    <div className="colunas editor-publicacao">
      <form action={acao} onChange={() => setVisto(estado)} className="coluna-principal painel" noValidate aria-describedby={erro ? 'erro-publicacao' : undefined}>
        {inicial?.id ? <input type="hidden" name="id" value={inicial.id} /> : null}
        {erro ? <div id="erro-publicacao"><Aviso tipo="erro">{erro}</Aviso></div> : null}
        {bloqueada ? <Aviso tipo="info">Esta publicação já está no ar. Só a coordenação ou a direção podem alterá-la.</Aviso> : null}

        <fieldset className="tipo-publicacao" disabled={bloqueada}>
          <legend className="se-campo-rotulo">Tipo</legend>
          <div className="segmentado">
            {(Object.keys(TIPO_PUBLICACAO) as TipoPublicacao[]).map((k) => (
              <label key={k}>
                <input type="radio" name="tipo" value={k} checked={tipo === k} onChange={() => setTipo(k)} />
                <span>{TIPO_PUBLICACAO[k].rotulo}</span>
              </label>
            ))}
          </div>
          <p className="legenda">{DICAS[tipo]}</p>
        </fieldset>

        <fieldset disabled={bloqueada} className="campos-publicacao">
          <div className="se-campo">
            <label htmlFor="titulo" className="se-campo-rotulo">Título <span className="se-campo-obrig" aria-hidden="true">*</span></label>
            <input id="titulo" name="titulo" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
              className="se-campo-input" aria-invalid={erroEm('titulo') ? true : undefined} placeholder="Ex.: Festa de Santa Escolástica" />
          </div>
          <div className="se-campo">
            <label htmlFor="resumo" className="se-campo-rotulo">Resumo <span className="se-campo-obrig" aria-hidden="true">*</span></label>
            <textarea id="resumo" name="resumo" required maxLength={200} rows={2} value={resumo} onChange={(e) => setResumo(e.target.value)}
              className="se-campo-input" aria-invalid={erroEm('resumo') ? true : undefined} aria-describedby="resumo-dica" />
            <span id="resumo-dica" className="se-campo-desc">Uma ou duas frases. Aparece nos cartões do site. {resumo.length}/200</span>
          </div>
          <div className="se-campo">
            <label htmlFor="texto" className="se-campo-rotulo">Texto</label>
            <textarea id="texto" name="texto" rows={10} maxLength={20000} value={texto} onChange={(e) => setTexto(e.target.value)}
              className="se-campo-input" aria-describedby="texto-dica" />
            <span id="texto-dica" className="se-campo-desc">Deixe uma linha em branco entre os parágrafos.</span>
          </div>

          {tipo === 'evento' ? (
            <div className="painel-interno">
              <h2 className="secao-titulo">Quando e onde</h2>
              <div className="lado-a-lado">
                <div className="se-campo">
                  <label htmlFor="evento_data" className="se-campo-rotulo">Data <span className="se-campo-obrig" aria-hidden="true">*</span></label>
                  <input id="evento_data" name="evento_data" type="date" required value={evData} onChange={(e) => setEvData(e.target.value)}
                    className="se-campo-input" aria-invalid={erroEm('evento_data') ? true : undefined} />
                </div>
                <div className="se-campo">
                  <label htmlFor="evento_inicio" className="se-campo-rotulo">Começa às</label>
                  <input id="evento_inicio" name="evento_inicio" type="time" value={evIni} onChange={(e) => setEvIni(e.target.value)} className="se-campo-input" />
                </div>
                <div className="se-campo">
                  <label htmlFor="evento_fim" className="se-campo-rotulo">Termina às</label>
                  <input id="evento_fim" name="evento_fim" type="time" value={evFim} onChange={(e) => setEvFim(e.target.value)}
                    className="se-campo-input" aria-invalid={erroEm('evento_fim') ? true : undefined} />
                </div>
              </div>
              <div className="se-campo">
                <label htmlFor="evento_local" className="se-campo-rotulo">Local</label>
                <input id="evento_local" name="evento_local" maxLength={160} value={evLocal} onChange={(e) => setEvLocal(e.target.value)}
                  className="se-campo-input" placeholder="Em branco: na escola" />
              </div>
            </div>
          ) : null}

          <div className="se-campo">
            <label htmlFor="visibilidade" className="se-campo-rotulo">Quem pode ver</label>
            <select id="visibilidade" name="visibilidade" value={vis} onChange={(e) => setVis(e.target.value as Visibilidade)} className="se-campo-input" aria-describedby="vis-dica">
              {(Object.keys(VISIBILIDADE) as Visibilidade[]).map((k) => <option key={k} value={k}>{VISIBILIDADE[k]}</option>)}
            </select>
            <span id="vis-dica" className="se-campo-desc">
              {vis === 'publico' ? 'Aparece no site, para qualquer pessoa.' : 'Não aparece no site: fica na área da família (com login).'}
            </span>
          </div>
          {vis === 'turma' ? (
            <div className="se-campo">
              <label htmlFor="turma_id" className="se-campo-rotulo">Turma <span className="se-campo-obrig" aria-hidden="true">*</span></label>
              <select id="turma_id" name="turma_id" value={turma} onChange={(e) => setTurma(e.target.value)} className="se-campo-input" aria-invalid={erroEm('turma_id') ? true : undefined}>
                <option value="">Escolha a turma</option>
                {turmas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </div>
          ) : null}

          {agendar ? (
            <div className="se-campo">
              <label htmlFor="publicar_em" className="se-campo-rotulo">Publicar em</label>
              <input id="publicar_em" name="publicar_em" type="datetime-local" required className="se-campo-input" aria-invalid={erroEm('publicar_em') ? true : undefined} />
              <span className="se-campo-desc">Horário de Itapecerica. Até lá, só a equipe vê.</span>
            </div>
          ) : null}

          <div className="acoes acoes-publicacao">
            <button type="submit" name="acao" value="rascunho" className="se-btn se-btn-secundario se-btn-md" disabled={enviando}>
              {inicial?.status === 'publicada' ? 'Tirar do ar e salvar como rascunho' : 'Salvar rascunho'}
            </button>
            {podePublicar ? (
              agendar ? (
                <>
                  <button type="button" className="se-btn se-btn-texto se-btn-md" onClick={() => setAgendar(false)}>Cancelar agendamento</button>
                  <button type="submit" name="acao" value="agendar" className="se-btn se-btn-primario se-btn-md" disabled={enviando}>Agendar</button>
                </>
              ) : (
                <>
                  <button type="button" className="se-btn se-btn-texto se-btn-md" onClick={() => setAgendar(true)}>Agendar…</button>
                  <button type="submit" name="acao" value="publicar" className="se-btn se-btn-primario se-btn-md" disabled={enviando}>
                    {inicial?.status === 'publicada' ? 'Salvar alterações' : 'Publicar agora'}
                  </button>
                </>
              )
            ) : null}
          </div>
          {enviando ? <p className="legenda" role="status">Salvando…</p> : null}
        </fieldset>
      </form>

      <aside className="coluna-lateral" aria-label="Pré-visualização">
        <div className="previa-rotulo legenda">Como vai aparecer{vis === 'publico' ? ' no site' : ' na área da família'}</div>
        <div className="site-cartao site-cartao-noticia previa-cartao">
          <div className={`site-capa site-capa-${tipo}`} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca/emblema.png" alt="" />
            {dm ? <span className="site-capa-data"><b>{dm.dia}</b>{dm.mes}</span> : null}
          </div>
          <div className="site-cartao-corpo">
            <span className="site-cartao-meta">
              <Selo tom={t.tom}>{t.rotulo}</Selo>
              {vis === 'turma' ? <Selo tom="neutro">{nomeTurma ? `Turma ${nomeTurma}` : 'Uma turma'}</Selo> : vis === 'familias' ? <Selo tom="neutro">Famílias</Selo> : null}
            </span>
            <span className="site-cartao-titulo">{titulo || 'Título da publicação'}</span>
            <span className="site-cartao-resumo">{resumo || 'O resumo aparece aqui.'}</span>
            {tipo === 'evento' && evData ? (
              <span className="legenda">{dataPorExtenso(evData, true)}{horario ? ` · ${horario}` : ''}{evLocal ? ` · ${evLocal}` : ''}</span>
            ) : null}
          </div>
        </div>
        {paragrafos.length ? (
          <div className="painel previa-texto">
            {paragrafos.map((p, i) => <p key={i}>{p}</p>)}
            {texto.split(/\n\s*\n/).filter((x) => x.trim()).length > 2 ? <p className="legenda">…</p> : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
