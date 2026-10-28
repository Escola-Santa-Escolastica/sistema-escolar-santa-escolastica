/**
 * Regras de duração da sessão (valem para todos os perfis).
 *
 * - Inatividade: sem usar o sistema por INATIVIDADE_MIN minutos, a sessão
 *   termina e é preciso entrar de novo. Dois minutos antes aparece um aviso.
 * - Duração máxima: mesmo usando, depois de DURACAO_MAXIMA_H horas do login
 *   a pessoa entra de novo (um dia de trabalho).
 *
 * O horário do último uso fica num cookie só do servidor (httpOnly), renovado
 * pelo proxy a cada página. O horário do login vem do próprio token do
 * Supabase (assinado), então não dá para ser alterado no navegador.
 */
export const INATIVIDADE_MIN = 30;
export const DURACAO_MAXIMA_H = 12;
export const AVISO_ANTES_MIN = 2;

export const INATIVIDADE_MS = INATIVIDADE_MIN * 60_000;
export const DURACAO_MAXIMA_MS = DURACAO_MAXIMA_H * 3_600_000;
export const AVISO_ANTES_MS = AVISO_ANTES_MIN * 60_000;

export const COOKIE_ATIVIDADE = 'se_atividade';

export function opcoesCookieAtividade() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // sem maxAge: some quando o navegador é fechado
  };
}

type Claims = { amr?: unknown; iat?: unknown } | null | undefined;

/** Momento (ms) da última autenticação (senha ou link), lido do token assinado. */
export function momentoDoLogin(claims: Claims): number | null {
  const amr = Array.isArray(claims?.amr) ? (claims.amr as { timestamp?: unknown }[]) : [];
  const tempos = amr.map((a) => Number(a?.timestamp)).filter((t) => Number.isFinite(t) && t > 0);
  return tempos.length ? Math.max(...tempos) * 1000 : null;
}

export type SituacaoSessao = { valida: true; restanteMs: number } | { valida: false; motivo: 'inatividade' | 'tempo' };

/** Confere a sessão contra as duas regras. `ultimaAtividade` vem do cookie. */
export function avaliarSessao(claims: Claims, ultimaAtividade: string | undefined, agora = Date.now()): SituacaoSessao {
  const login = momentoDoLogin(claims);
  if (login !== null && agora - login > DURACAO_MAXIMA_MS) return { valida: false, motivo: 'tempo' };
  const ultima = Number(ultimaAtividade);
  if (!ultima || agora - ultima > INATIVIDADE_MS) return { valida: false, motivo: 'inatividade' };
  const restanteInatividade = INATIVIDADE_MS - (agora - ultima);
  const restanteMaximo = login !== null ? DURACAO_MAXIMA_MS - (agora - login) : Infinity;
  return { valida: true, restanteMs: Math.min(restanteInatividade, restanteMaximo) };
}
