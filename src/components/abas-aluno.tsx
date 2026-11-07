import Link from 'next/link';

/** Abas da ficha do aluno. */
export function AbasAluno({ id, atual }: { id: string; atual: 'ficha' | 'frequencia' }) {
  return (
    <nav aria-label="Seções do aluno" className="abas">
      <Link href={`/alunos/${id}`} aria-current={atual === 'ficha' ? 'page' : undefined}>Ficha</Link>
      <Link href={`/alunos/${id}/frequencia`} aria-current={atual === 'frequencia' ? 'page' : undefined}>Frequência</Link>
    </nav>
  );
}
