import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE, dataPorExtenso } from '@/lib/site';
import { CabecalhoSite, RodapeSite } from '@/components/site/estrutura';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como o Instituto Santa Escolástica trata os dados pessoais de crianças, famílias e visitantes.',
};

/*
 * RASCUNHO para revisão da escola (de preferência com orientação jurídica).
 * Descreve o que o site e o sistema fazem hoje. Se mudar algo no sistema
 * (novos dados, novos fornecedores, cookies), atualize este texto e a data.
 */
const ATUALIZADO_EM = '2026-11-18';

const SECOES: { id: string; titulo: string; corpo: React.ReactNode }[] = [
  {
    id: 'quem',
    titulo: 'Quem cuida dos seus dados',
    corpo: (
      <p>
        O {SITE.nome}, {SITE.endereco}, é o responsável (controlador) pelos dados pessoais tratados neste site e no
        sistema da escola. Para qualquer assunto sobre seus dados, fale com a secretaria pelo e-mail{' '}
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ou pelo telefone {SITE.telefone}.
      </p>
    ),
  },
  {
    id: 'quais',
    titulo: 'Quais dados tratamos',
    corpo: (
      <>
        <p><strong>No site, sem login.</strong> Quando você pede uma visita, guardamos seu nome, seu telefone, a idade da criança e a sua autorização para o contato. Não usamos o site para coletar outros dados.</p>
        <p><strong>Na matrícula e durante o ano letivo.</strong> Para matricular e acompanhar a criança, a escola registra:</p>
        <ul>
          <li>dados da criança: nome, data de nascimento, documentos (certidão, CPF, RG ou CIN, Cartão SUS, NIS), naturalidade, sexo, cor ou raça (exigida pelo Censo Escolar), endereço e turma;</li>
          <li>informações de saúde e de cuidado: alergias, restrições alimentares, laudos e atendimento especializado, quando a família informa;</li>
          <li>dados dos responsáveis e das pessoas autorizadas a buscar a criança: nome, documentos, telefones, e-mail e parentesco;</li>
          <li>vida escolar: matrícula, documentos entregues, frequência, faltas avisadas e justificativas;</li>
          <li>dados de acesso de quem usa o sistema (e-mail e registro de quem alterou o quê e quando).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'para-que',
    titulo: 'Para que usamos',
    corpo: (
      <ul>
        <li>combinar a visita que você pediu (com a sua autorização);</li>
        <li>fazer a matrícula, organizar as turmas e cumprir o contrato de prestação de serviços educacionais;</li>
        <li>cumprir obrigações legais da escola, como o registro da frequência, a guarda da documentação escolar e o Censo Escolar;</li>
        <li>cuidar da saúde e da segurança da criança, por exemplo em uma alergia ou numa emergência;</li>
        <li>falar com a família sobre a vida escolar (avisos, faltas, reuniões).</li>
      </ul>
    ),
  },
  {
    id: 'criancas',
    titulo: 'Dados de crianças',
    corpo: (
      <p>
        Tratamos os dados das crianças sempre no melhor interesse delas, como pede a Lei Geral de Proteção de Dados
        (LGPD, art. 14), com o conhecimento dos pais ou responsáveis. Cada pessoa da equipe vê só o que precisa para o
        seu trabalho: a professora e a auxiliar veem apenas as crianças da própria turma, sem os documentos pessoais; a
        família vê apenas os próprios filhos.
      </p>
    ),
  },
  {
    id: 'compartilhamento',
    titulo: 'Com quem compartilhamos',
    corpo: (
      <>
        <p>Não vendemos nem cedemos dados para propaganda. Os dados só saem da escola quando é necessário:</p>
        <ul>
          <li>para órgãos públicos de educação, quando a lei exige (por exemplo, Censo Escolar e Secretaria de Educação);</li>
          <li>para os fornecedores de tecnologia que hospedam o site e o banco de dados do sistema, que tratam os dados só sob as instruções da escola;</li>
          <li>por ordem judicial ou de autoridade competente.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'tempo',
    titulo: 'Por quanto tempo guardamos',
    corpo: (
      <p>
        Os pedidos de visita são guardados só enquanto servem para o contato e o processo de matrícula. Os registros da
        vida escolar (matrícula, frequência e documentos) são guardados pelo tempo que a legislação educacional exige,
        porque comprovam a escolaridade da criança. Os demais dados são apagados quando deixam de ser necessários.
      </p>
    ),
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    corpo: (
      <p>
        O sistema só abre com login, cada perfil tem acesso limitado ao que precisa, a sessão termina depois de 30
        minutos sem uso, e as alterações importantes ficam registradas com o nome de quem fez. Mesmo assim, nenhum
        sistema é totalmente imune a falhas; se algo acontecer, avisaremos as famílias afetadas e as autoridades, como
        manda a lei.
      </p>
    ),
  },
  {
    id: 'cookies',
    titulo: 'Cookies',
    corpo: (
      <p>
        O site usa apenas os cookies necessários para o login funcionar e para encerrar a sessão por inatividade. Não
        usamos cookies de propaganda nem ferramentas de rastreamento de visitantes.
      </p>
    ),
  },
  {
    id: 'direitos',
    titulo: 'Seus direitos',
    corpo: (
      <>
        <p>
          Você pode pedir, a qualquer momento: a confirmação de que tratamos seus dados ou os da criança, uma cópia deles,
          a correção do que estiver errado, a exclusão do que não for mais necessário ou não tiver base legal, informações
          sobre com quem compartilhamos e a retirada da autorização dada no pedido de visita (LGPD, art. 18).
        </p>
        <p>
          Faça o pedido pelo e-mail <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ou na secretaria. Se não ficar
          satisfeito com a resposta, você pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </>
    ),
  },
];

export default function Privacidade() {
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-largura site-pagina site-texto-legal">
        <nav aria-label="Caminho" className="caminho"><Link href="/">Início</Link> / Política de privacidade</nav>
        <div>
          <h1 className="site-titulo-pagina">Política de privacidade</h1>
          <p className="site-subtitulo-pagina">Como cuidamos dos dados das crianças, das famílias e de quem visita este site. Atualizada em {dataPorExtenso(ATUALIZADO_EM)}.</p>
        </div>
        <nav aria-label="Nesta página" className="site-texto-indice">
          <ol>{SECOES.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.titulo}</a></li>)}</ol>
        </nav>
        {SECOES.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`t-${s.id}`}>
            <h2 id={`t-${s.id}`}>{s.titulo}</h2>
            {s.corpo}
          </section>
        ))}
      </main>
      <RodapeSite />
    </div>
  );
}
