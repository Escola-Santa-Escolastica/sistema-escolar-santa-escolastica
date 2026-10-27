/**
 * Faixa fixa no topo de todas as páginas quando o sistema roda como
 * ambiente de teste (NEXT_PUBLIC_AMBIENTE=teste). Lembra quem testa de
 * não digitar dados reais de crianças.
 */
export function FaixaTeste() {
  if (process.env.NEXT_PUBLIC_AMBIENTE !== 'teste') return null;
  return (
    <div role="note" className="faixa-teste">
      <strong>Ambiente de teste.</strong>{' '}
      <span className="faixa-longa">Use apenas dados fictícios: nada aqui é real e tudo pode ser apagado.</span>
      <span className="faixa-curta">Use só dados fictícios.</span>
    </div>
  );
}
