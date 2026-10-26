/**
 * Componentes do design system "Instituto Santa Escolástica" em React/TSX.
 * Mesmos nomes, variantes e regras de uso do design system publicado.
 */
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { type TomSelo } from '@/lib/formatos';

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(' ');
}

type VarianteBotao = 'primario' | 'secundario' | 'texto' | 'perigo';
type PropsBotaoBase = { variante?: VarianteBotao; tamanho?: 'md' | 'sm'; larguraTotal?: boolean };

function classesBotao({ variante = 'secundario', tamanho = 'md', larguraTotal }: PropsBotaoBase, extra?: string) {
  return cx('se-btn', `se-btn-${variante === 'perigo' ? 'secundario se-btn-perigo' : variante}`, `se-btn-${tamanho}`, larguraTotal && 'se-btn-full', extra);
}

/** Primário no máximo uma vez por tela; o resto secundário ou texto. */
export function Botao({ variante, tamanho, larguraTotal, className, type = 'button', ...rest }: PropsBotaoBase & ComponentProps<'button'>) {
  return <button type={type} className={classesBotao({ variante, tamanho, larguraTotal }, className)} {...rest} />;
}

/** Link com cara de botão (navegação, nunca ação). */
export function BotaoLink({ variante, tamanho, larguraTotal, className, ...rest }: PropsBotaoBase & ComponentProps<typeof Link>) {
  return <Link className={classesBotao({ variante, tamanho, larguraTotal }, className)} {...rest} />;
}

/** Uma ou duas palavras de situação; nunca só a cor. */
export function Selo({ tom = 'neutro', children }: { tom?: TomSelo; children: ReactNode }) {
  return <span className={cx('se-selo', `se-selo-${tom}`)}>{children}</span>;
}

type PropsCampoBase = { rotulo: string; dica?: string; erro?: string; obrigatorio?: boolean; className?: string };

function Rotulo({ id, rotulo, obrigatorio }: { id: string; rotulo: string; obrigatorio?: boolean }) {
  return (
    <label htmlFor={id} className="se-campo-rotulo">
      {rotulo}
      {obrigatorio ? <span className="se-campo-obrig" aria-hidden="true"> *</span> : null}
    </label>
  );
}

function Descricao({ id, dica, erro }: { id: string; dica?: string; erro?: string }) {
  const texto = erro || dica;
  return texto ? <p id={`${id}-desc`} className="se-campo-desc">{texto}</p> : null;
}

/** Campo de texto com rótulo sempre visível (igual ao da Ficha Individual). */
export function Campo({ rotulo, dica, erro, obrigatorio, className, id, name, ...rest }: PropsCampoBase & Omit<ComponentProps<'input'>, 'required'>) {
  const cid = id ?? `campo-${name}`;
  return (
    <div className={cx('se-campo', erro && 'se-campo-erro', className)}>
      <Rotulo id={cid} rotulo={rotulo} obrigatorio={obrigatorio} />
      <input id={cid} name={name} className="se-campo-input" required={obrigatorio} aria-invalid={erro ? true : undefined}
        aria-describedby={erro || dica ? `${cid}-desc` : undefined} {...rest} />
      <Descricao id={cid} dica={dica} erro={erro} />
    </div>
  );
}

export function CampoSelect({ rotulo, dica, erro, obrigatorio, className, id, name, children, ...rest }: PropsCampoBase & Omit<ComponentProps<'select'>, 'required'>) {
  const cid = id ?? `campo-${name}`;
  return (
    <div className={cx('se-campo', erro && 'se-campo-erro', className)}>
      <Rotulo id={cid} rotulo={rotulo} obrigatorio={obrigatorio} />
      <select id={cid} name={name} className="se-campo-input" required={obrigatorio} aria-invalid={erro ? true : undefined}
        aria-describedby={erro || dica ? `${cid}-desc` : undefined} {...rest}>
        {children}
      </select>
      <Descricao id={cid} dica={dica} erro={erro} />
    </div>
  );
}

export function CampoTexto({ rotulo, dica, erro, obrigatorio, className, id, name, ...rest }: PropsCampoBase & Omit<ComponentProps<'textarea'>, 'required'>) {
  const cid = id ?? `campo-${name}`;
  return (
    <div className={cx('se-campo', erro && 'se-campo-erro', className)}>
      <Rotulo id={cid} rotulo={rotulo} obrigatorio={obrigatorio} />
      <textarea id={cid} name={name} className="se-campo-input" required={obrigatorio} aria-invalid={erro ? true : undefined}
        aria-describedby={erro || dica ? `${cid}-desc` : undefined} {...rest} />
      <Descricao id={cid} dica={dica} erro={erro} />
    </div>
  );
}

export function Check({ rotulo, className, ...rest }: { rotulo: string; className?: string } & Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <label className={cx('se-check', className)}>
      <input type="checkbox" {...rest} />
      <span>{rotulo}</span>
    </label>
  );
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ nome, foto, tamanho = 'md' }: { nome: string; foto?: string | null; tamanho?: 'md' | 'lg' }) {
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cx('se-avatar', `se-avatar-${tamanho}`)} src={foto} alt="" />;
  }
  return <span className={cx('se-avatar', `se-avatar-${tamanho}`)} aria-hidden="true">{iniciais(nome)}</span>;
}

export type AlertaAluno = { tipo: 'alergia' | 'medicacao' | 'restricao' | 'laudo'; texto?: string | null };
const ROTULO_ALERTA: Record<AlertaAluno['tipo'], string> = {
  alergia: 'Alergia',
  medicacao: 'Medicação',
  restricao: 'Restrição alimentar',
  laudo: 'Laudo',
};

export function SelosAlerta({ alertas, comDetalhe = true }: { alertas: AlertaAluno[]; comDetalhe?: boolean }) {
  if (!alertas.length) return null;
  return (
    <div className="selos">
      {alertas.map((a, i) => (
        <Selo key={i} tom={a.tipo === 'laudo' ? 'dourado' : 'alerta'}>
          {ROTULO_ALERTA[a.tipo]}
          {comDetalhe && a.texto ? `: ${a.texto}` : ''}
        </Selo>
      ))}
    </div>
  );
}

/** Resumo da criança: foto, nome, turma e alertas que o perfil pode ver. */
export function CartaoAluno({ nome, meta, foto, alertas = [], acao }: {
  nome: string; meta?: string; foto?: string | null; alertas?: AlertaAluno[]; acao?: ReactNode;
}) {
  return (
    <article className="se-cartao">
      <Avatar nome={nome} foto={foto} tamanho="lg" />
      <div className="se-cartao-corpo">
        <h2 className="se-cartao-nome">{nome}</h2>
        {meta ? <p className="se-cartao-meta">{meta}</p> : null}
        {alertas.length ? <div className="se-cartao-alertas"><SelosAlerta alertas={alertas} /></div> : null}
      </div>
      {acao ? <div className="se-cartao-acao">{acao}</div> : null}
    </article>
  );
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'ok'; children: ReactNode }) {
  return <div role={tipo === 'erro' ? 'alert' : 'status'} className={cx('aviso', `aviso-${tipo}`)}>{children}</div>;
}

/** Converte os dados de saúde/laudo do banco nos selos de alerta. */
export function alertasDe(saude?: { alergias?: string | null; medicamento_continuo?: string | null; restricao_alimentar?: string | null } | null,
  possuiLaudo?: boolean | null): AlertaAluno[] {
  const lista: AlertaAluno[] = [];
  if (saude?.alergias) lista.push({ tipo: 'alergia', texto: saude.alergias });
  if (saude?.medicamento_continuo) lista.push({ tipo: 'medicacao', texto: saude.medicamento_continuo });
  if (saude?.restricao_alimentar) lista.push({ tipo: 'restricao', texto: saude.restricao_alimentar });
  if (possuiLaudo) lista.push({ tipo: 'laudo' });
  return lista;
}
