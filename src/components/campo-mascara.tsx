'use client';

import type { ChangeEvent, ComponentProps } from 'react';
import { Campo } from '@/components/ui';
import { mascaraCep, mascaraCpf, mascaraRg, mascaraTelefone } from '@/lib/formatos';

type PropsCampo = ComponentProps<typeof Campo>;

/** Quantos caracteres "de verdade" (números e X) há antes da posição do cursor. */
function contarAte(texto: string, pos: number) {
  return texto.slice(0, pos).replace(/[^0-9X]/gi, '').length;
}

/** Posição no texto formatado logo depois do n-ésimo caractere "de verdade". */
function posicaoDepois(texto: string, n: number) {
  if (n === 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/[0-9X]/i.test(texto[i])) vistos++;
    if (vistos === n) return i + 1;
  }
  return texto.length;
}

/**
 * Campo que formata enquanto a pessoa digita (CPF, telefone, CEP, RG),
 * sem tirar o cursor do lugar. O servidor guarda só os números.
 */
function CampoMascarado({ mascara, defaultValue, onChange, ...rest }: PropsCampo & { mascara: (v: string) => string }) {
  function aoMudar(e: ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const antes = el.value;
    const reais = contarAte(antes, el.selectionStart ?? antes.length);
    const depois = mascara(antes);
    if (depois !== antes) {
      el.value = depois;
      const pos = posicaoDepois(depois, reais);
      el.setSelectionRange(pos, pos);
    }
    onChange?.(e);
  }
  return (
    <Campo
      {...rest}
      defaultValue={defaultValue ? mascara(String(defaultValue)) : undefined}
      onChange={aoMudar}
      autoComplete="off"
    />
  );
}

export function CampoCpf(props: PropsCampo) {
  return <CampoMascarado inputMode="numeric" placeholder="000.000.000-00" maxLength={14} {...props} mascara={mascaraCpf} />;
}

export function CampoTelefone(props: PropsCampo) {
  return <CampoMascarado inputMode="tel" placeholder="(37) 99999-9999" maxLength={15} {...props} mascara={mascaraTelefone} />;
}

export function CampoCep(props: PropsCampo) {
  return <CampoMascarado inputMode="numeric" placeholder="35550-000" maxLength={9} {...props} mascara={mascaraCep} />;
}

export function CampoRg(props: PropsCampo) {
  return <CampoMascarado placeholder="00.000.000" maxLength={13} autoCapitalize="characters" {...props} mascara={(v) => mascaraRg(v)} />;
}
