import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { carregarFicha } from '@/lib/aluno';
import { GESTAO, temAlgum } from '@/lib/perfis';
import {
  CORES_RACA, formatarCep, formatarCpf, formatarData, formatarTelefone, idadeEmAnos, mascararCpf, STATUS_MATRICULA, TURNOS,
} from '@/lib/formatos';
import { BotaoLink, CartaoAluno, Selo, alertasDe } from '@/components/ui';

export const metadata: Metadata = { title: 'Ficha do aluno' };

function Dado({ rotulo, valor, className }: { rotulo: string; valor: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt>{rotulo}</dt>
      <dd>{valor === null || valor === undefined || valor === '' ? '—' : valor}</dd>
    </div>
  );
}

const simNao = (v: boolean | undefined | null) => (v ? 'Sim' : 'Não');

export default async function FichaDoAluno({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao(['direcao', 'coordenacao', 'secretaria', 'professor_regente', 'professor_especialista', 'auxiliar']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteSupabase();
  const ficha = await carregarFicha(supabase, id);
  if (!ficha) notFound();

  const { aluno, endereco, saude, atendimento, vinculos, matriculas } = ficha;
  const p = aluno.pessoa;
  const eGestao = temAlgum(sessao.papeis, GESTAO);
  const podeEditar = sessao.papeis.includes('secretaria') || sessao.papeis.includes('coordenacao');
  const cpf = (v: string | null) => (eGestao ? formatarCpf(v) || '—' : mascararCpf(v));
  const atual = matriculas.find((m) => m.ano_letivo.ativo && m.status !== 'cancelado');
  const idade = idadeEmAnos(p.data_nascimento);
  const nome = p.nome_social || p.nome;
  const alertas = alertasDe(saude, atendimento?.possui_laudo);

  return (
    <main className="pagina">
      <nav aria-label="Caminho" className="caminho"><Link href="/alunos">Alunos</Link> / {nome}</nav>

      <div className="topo">
        <div className="topo-texto" style={{ minWidth: 320 }}>
          <CartaoAluno
            nome={nome}
            meta={[atual?.etapa.nome, atual?.turma?.nome ?? null, idade !== null ? `${idade} anos` : null].filter(Boolean).join(' · ')}
            alertas={alertas}
          />
        </div>
        <div className="acoes">
          {podeEditar ? <BotaoLink href={`/alunos/${id}/editar`}>Editar ficha</BotaoLink> : null}
          {eGestao && atual ? <BotaoLink href={`/matriculas/${atual.id}`} variante="primario">Ver matrícula</BotaoLink> : null}
        </div>
      </div>

      <div className="colunas">
        <div className="coluna-principal">
          {saude?.alergias || saude?.medicamento_continuo || saude?.restricao_alimentar ? (
            <div className="painel-alerta" role="note">
              {saude.alergias ? <div><strong>Alergia:</strong> {saude.alergias}</div> : null}
              {saude.medicamento_continuo ? <div><strong>Medicamento contínuo:</strong> {saude.medicamento_continuo}</div> : null}
              {saude.restricao_alimentar ? <div><strong>Restrição alimentar:</strong> {saude.restricao_alimentar}</div> : null}
            </div>
          ) : null}

          <section className="painel" aria-labelledby="t-ident">
            <h2 id="t-ident" className="secao-titulo" style={{ marginBottom: 16 }}>1. Identificação</h2>
            <dl className="dados">
              <Dado className="span-2" rotulo="Nome completo" valor={p.nome} />
              <Dado rotulo="Nome social" valor={p.nome_social} />
              <Dado rotulo="Data de nascimento" valor={`${formatarData(p.data_nascimento)}${idade !== null ? ` · ${idade} anos` : ''}`} />
              <Dado rotulo="Naturalidade" valor={aluno.naturalidade} />
              <Dado rotulo="Nacionalidade" valor={aluno.nacionalidade} />
              <Dado rotulo="Sexo" valor={p.sexo === 'feminino' ? 'Feminino' : p.sexo === 'masculino' ? 'Masculino' : null} />
              {eGestao ? <Dado rotulo="Cor/Raça" valor={aluno.cor_raca ? CORES_RACA[aluno.cor_raca as keyof typeof CORES_RACA] : null} /> : null}
              <Dado rotulo="Tipo sanguíneo" valor={aluno.tipo_sanguineo ? `${aluno.tipo_sanguineo}${aluno.fator_rh ?? ''}` : null} />
              <Dado rotulo="CPF" valor={cpf(p.cpf)} />
              {eGestao ? (
                <>
                  <Dado rotulo="CIN" valor={p.cin} />
                  <Dado rotulo="RG" valor={p.rg ? `${p.rg}${p.rg_orgao_expedidor ? ` · ${p.rg_orgao_expedidor}` : ''}` : null} />
                  <Dado rotulo="Emissão do RG" valor={p.rg_data_emissao ? formatarData(p.rg_data_emissao) : null} />
                  <Dado rotulo="Nº do SUS" valor={aluno.numero_sus} />
                  <Dado rotulo="NIS" valor={aluno.nis} />
                </>
              ) : null}
            </dl>
          </section>

          <section className="painel" aria-labelledby="t-resp">
            <h2 id="t-resp" className="secao-titulo" style={{ marginBottom: 8 }}>2. Filiação e responsáveis</h2>
            {vinculos.length === 0 ? <p className="vazio">Nenhum responsável cadastrado.</p> : (
              <ul className="lista-linhas">
                {vinculos.map((v) => (
                  <li key={v.id}>
                    <div className="cresce">
                      <div style={{ fontWeight: 600 }}>{v.pessoa?.nome}</div>
                      <div className="legenda">
                        {[v.parentesco, v.responsavel_legal ? 'responsável legal' : null, v.responsavel_financeiro ? 'financeiro' : null,
                          v.contato_emergencia ? 'contato de emergência' : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {v.pessoa?.telefone ? <a href={`tel:${v.pessoa.telefone}`}>{formatarTelefone(v.pessoa.telefone)}</a> : null}
                    {v.pode_buscar ? <Selo tom="verde">Pode buscar</Selo> : <Selo>Não busca</Selo>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="painel" aria-labelledby="t-saude">
            <h2 id="t-saude" className="secao-titulo" style={{ marginBottom: 16 }}>3. Informações de saúde</h2>
            {saude ? (
              <dl className="dados dados-2">
                <Dado rotulo="Problema de saúde" valor={saude.problema_saude ?? 'Não possui'} />
                <Dado rotulo="Alergias" valor={saude.alergias ?? 'Não possui'} />
                <Dado rotulo="Medicamento contínuo" valor={saude.medicamento_continuo ?? 'Não usa'} />
                <Dado rotulo="Restrição alimentar" valor={saude.restricao_alimentar ?? 'Não possui'} />
                <Dado rotulo="Convênio médico" valor={saude.convenio ? `${saude.convenio}${saude.convenio_carteirinha ? ` · nº ${saude.convenio_carteirinha}` : ''}` : 'Não possui'} />
                <Dado rotulo="Em caso de emergência, avisar"
                  valor={saude.emergencia_nome ? `${saude.emergencia_nome}${saude.emergencia_telefone ? ` · ${formatarTelefone(saude.emergencia_telefone)}` : ''}` : null} />
                <Dado className="span-todo" rotulo="Observações importantes" valor={saude.observacoes} />
              </dl>
            ) : <p className="vazio">Sem informações de saúde cadastradas.</p>}
          </section>

          {atendimento ? (
            <section className="painel" aria-labelledby="t-atend">
              <h2 id="t-atend" className="secao-titulo" style={{ marginBottom: 16 }}>4. Atendimento especializado</h2>
              <dl className="dados dados-2">
                <Dado rotulo="Possui laudo / necessidade especial" valor={atendimento.possui_laudo ? atendimento.laudo_descricao || 'Sim' : 'Não'} />
                <Dado rotulo="Acompanha atendimento especializado" valor={atendimento.acompanha_atendimento ? atendimento.atendimento_descricao || 'Sim' : 'Não'} />
                <Dado className="span-todo" rotulo="Observações pedagógicas" valor={atendimento.observacoes_pedagogicas} />
              </dl>
            </section>
          ) : null}

          {endereco ? (
            <section className="painel" aria-labelledby="t-end">
              <h2 id="t-end" className="secao-titulo" style={{ marginBottom: 16 }}>Endereço e convênios</h2>
              <dl className="dados">
                <Dado className="span-2" rotulo="Endereço"
                  valor={[endereco.logradouro, endereco.numero, endereco.complemento].filter(Boolean).join(', ') || null} />
                <Dado rotulo="Bairro" valor={endereco.bairro} />
                <Dado rotulo="Cidade/UF" valor={[endereco.cidade, endereco.uf].filter(Boolean).join('/') || null} />
                <Dado rotulo="CEP" valor={formatarCep(endereco.cep)} />
                <Dado rotulo="Telefones" valor={[endereco.telefone_residencial, endereco.telefone_celular].filter(Boolean).map((t) => formatarTelefone(t)).join(' · ') || null} />
                <Dado rotulo="Transporte escolar" valor={simNao(aluno.transporte_escolar)} />
                <Dado rotulo="Bolsa Família" valor={simNao(aluno.bolsa_familia)} />
                <Dado rotulo="Ensino Religioso" valor={simNao(aluno.ensino_religioso)} />
                <Dado className="span-todo" rotulo="Dispensa de Educação Física" valor={aluno.dispensa_educacao_fisica ?? 'Não'} />
              </dl>
            </section>
          ) : null}
        </div>

        <aside className="coluna-lateral">
          <section className="painel" aria-labelledby="t-mats">
            <h2 id="t-mats" className="secao-titulo" style={{ marginBottom: 12 }}>Matrículas</h2>
            {matriculas.length === 0 ? <p className="legenda">Nenhuma.</p> : (
              <ul className="lista-linhas">
                {matriculas.map((m) => (
                  <li key={m.id}>
                    <div className="cresce">
                      {eGestao ? <Link href={`/matriculas/${m.id}`} style={{ fontWeight: 600 }}>{m.ano_letivo.ano} · {m.etapa.nome}</Link>
                        : <span style={{ fontWeight: 600 }}>{m.ano_letivo.ano} · {m.etapa.nome}</span>}
                      <div className="legenda">{m.turma?.nome ?? TURNOS[m.turno_pretendido]} · nº {m.numero}</div>
                    </div>
                    <Selo tom={STATUS_MATRICULA[m.status].tom}>{STATUS_MATRICULA[m.status].rotulo}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
