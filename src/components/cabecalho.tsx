'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ItemMenu } from '@/lib/perfis';

export function Cabecalho({ menu, nome, perfil, acaoSair }: {
  menu: Pick<ItemMenu, 'href' | 'rotulo'>[];
  nome: string;
  perfil: string;
  acaoSair: () => Promise<void>;
}) {
  const caminho = usePathname();
  return (
    <header className="cabecalho">
      <div className="cabecalho-inner">
        <Link href="/" className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/emblema.png" alt="" width={44} height={46} className="marca-emblema" />
          <span className="marca-texto">
            <span className="marca-nome">Instituto Santa Escolástica</span>
            <span className="marca-lema">FÉ · VIRTUDE · SABEDORIA</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="menu">
          {menu.map((item) => {
            const ativo = caminho === item.href || caminho.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} aria-current={ativo ? 'page' : undefined}>
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="usuario">
          <span>
            <span className="sr-only">Conectado como </span>
            {nome} <span className="usuario-perfil">· {perfil}</span>
          </span>
          <form action={acaoSair}>
            <button type="submit">Sair</button>
          </form>
        </div>
      </div>
      <div className="cabecalho-faixa" />
    </header>
  );
}
