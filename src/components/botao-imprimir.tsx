'use client';

import { Botao } from '@/components/ui';

export function BotaoImprimir({ children = 'Imprimir' }: { children?: React.ReactNode }) {
  return <Botao className="nao-imprimir" onClick={() => window.print()}>{children}</Botao>;
}
