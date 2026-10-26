import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirSessao } from '@/lib/sessao';
import { criarClienteSupabase } from '@/lib/supabase/server';
import { carregarFicha } from '@/lib/aluno';
import { CORES_RACA, formatarCep, formatarCpf, formatarTelefone } from '@/lib/formatos';
import { Botao, Campo, CampoSelect, CampoTexto, Check, Selo } from '@/components/ui';
import { FormSecao } from '@/components/form-secao';
import {
  adicionarResponsavel, convidarFamilia, removerVinculo, salvarAtendimento, salvarEndereco, salvarIdentificacao, salvarSaude,
} from '../../actions';

export const metadata: Metadata = { title: 'Editar ficha' };

export default async function EditarFicha({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirSessao(['secretaria', 'coordenacao']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteSupabase();
  const ficha = await carregarFicha(supabase, id);
  if (!ficha) notFound();
  const { aluno, endereco, saude, atendimento, vinculos } = ficha;
  const p = aluno.pessoa;
  const eSecretaria = sessao.papeis.includes('secretaria');
  const temConviteConfigurado = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <main className="pagina pagina-estreita">
      <nav aria-label="Caminho" className="caminho">
        <Link href="/alunos">Alunos</Link> / <Link href={`/alunos/${id}`}>{p.nome}</Link> / Editar
      </nav>
      <div className="topo"><div className="topo-texto"><p className="topo-sub">Ficha Individual do Aluno</p><h1 className="titulo">Editar ficha</h1></div></div>
      <p className="legenda" style={{ margin: 0 }}>Cada seção é salva separadamente. Toda alteração fica registrada na auditoria.</p>

      {eSecretaria ? (
        <FormSecao titulo="1. Identificação do aluno" acao={salvarIdentificacao} alunoId={id} rotuloBotao="Salvar identificação">
          <Campo className="c-4" rotulo="Nome completo" name="aluno.nome" defaultValue={p.nome} obrigatorio />
          <Campo className="c-2" rotulo="Nome social" name="aluno.nome_social" defaultValue={p.nome_social ?? ''} />
          <Campo className="c-2" rotulo="Data de nascimento" name="aluno.data_nascimento" type="date" defaultValue={p.data_nascimento ?? ''} obrigatorio />
          <Campo className="c-2" rotulo="Naturalidade" name="aluno.naturalidade" defaultValue={aluno.naturalidade ?? ''} />
          <Campo className="c-2" rotulo="Nacionalidade" name="aluno.nacionalidade" defaultValue={aluno.nacionalidade} />
          <CampoSelect className="c-2" rotulo="Sexo" name="aluno.sexo" defaultValue={p.sexo ?? ''}>
            <option value="">Não informado</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option>
          </CampoSelect>
          <CampoSelect className="c-2" rotulo="Cor/Raça" name="aluno.cor_raca" defaultValue={aluno.cor_raca ?? ''}>
            <option value="">Não informado</option>
            {Object.entries(CORES_RACA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </CampoSelect>
          <CampoSelect className="c-1" rotulo="Tipo sanguíneo" name="aluno.tipo_sanguineo" defaultValue={aluno.tipo_sanguineo ?? ''}>
            <option value="">—</option>{['A', 'B', 'AB', 'O'].map((t) => <option key={t}>{t}</option>)}
          </CampoSelect>
          <CampoSelect className="c-1" rotulo="Fator RH" name="aluno.fator_rh" defaultValue={aluno.fator_rh ?? ''}>
            <option value="">—</option><option value="+">+</option><option value="-">−</option>
          </CampoSelect>
          <Campo className="c-2" rotulo="CPF" name="aluno.cpf" defaultValue={formatarCpf(p.cpf)} inputMode="numeric" />
          <Campo className="c-2" rotulo="CIN" name="aluno.cin" defaultValue={p.cin ?? ''} />
          <Campo className="c-2" rotulo="RG" name="aluno.rg" defaultValue={p.rg ?? ''} />
          <Campo className="c-2" rotulo="Órgão Expedidor/Estado" name="aluno.rg_orgao_expedidor" defaultValue={p.rg_orgao_expedidor ?? ''} />
          <Campo className="c-2" rotulo="Data de emissão do RG" name="aluno.rg_data_emissao" type="date" defaultValue={p.rg_data_emissao ?? ''} />
          <Campo className="c-3" rotulo="Nº do SUS" name="aluno.numero_sus" defaultValue={aluno.numero_sus ?? ''} />
          <Campo className="c-3" rotulo="NIS" name="aluno.nis" defaultValue={aluno.nis ?? ''} />
          <div className="c-6" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
            <Check rotulo="Usa transporte escolar" name="aluno.transporte_escolar" defaultChecked={aluno.transporte_escolar} />
            <Check rotulo="Recebe Bolsa Família" name="aluno.bolsa_familia" defaultChecked={aluno.bolsa_familia} />
            <Check rotulo="Participa do Ensino Religioso" name="aluno.ensino_religioso" defaultChecked={aluno.ensino_religioso} />
          </div>
          <Campo className="c-6" rotulo="Motivo da dispensa de Educação Física" name="aluno.dispensa_educacao_fisica" defaultValue={aluno.dispensa_educacao_fisica ?? ''} />
        </FormSecao>
      ) : null}

      {eSecretaria ? (
        <section className="painel" aria-labelledby="t-resp" style={{ display: 'grid', gap: 12 }}>
          <h2 id="t-resp" className="secao-titulo">2. Filiação e responsáveis</h2>
          <ul className="lista-linhas">
            {vinculos.map((v) => (
              <li key={v.id}>
                <div className="cresce">
                  <div style={{ fontWeight: 600 }}>{v.pessoa?.nome}</div>
                  <div className="legenda">
                    {[v.parentesco, v.pessoa?.telefone ? formatarTelefone(v.pessoa.telefone) : null, v.pessoa?.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {v.pessoa?.user_id ? <Selo tom="verde">Tem acesso</Selo> : v.pessoa?.email && (v.responsavel_legal || v.filiacao) && temConviteConfigurado ? (
                  <form action={convidarFamilia}>
                    <input type="hidden" name="aluno_id" value={id} />
                    <input type="hidden" name="pessoa_id" value={v.pessoa.id} />
                    <Botao type="submit" tamanho="sm">Criar acesso da família</Botao>
                  </form>
                ) : null}
                <form action={removerVinculo}>
                  <input type="hidden" name="aluno_id" value={id} />
                  <input type="hidden" name="vinculo_id" value={v.id} />
                  <Botao type="submit" tamanho="sm" variante="texto">Remover</Botao>
                </form>
              </li>
            ))}
          </ul>
          <p className="legenda" style={{ margin: 0 }}>
            O acesso da família é para pai, mãe ou responsável legal com e-mail cadastrado. A pessoa recebe um link para criar a senha
            e vê apenas os próprios filhos.
          </p>
        </section>
      ) : null}

      {eSecretaria ? (
        <FormSecao key={vinculos.length} titulo="Adicionar responsável ou pessoa autorizada" acao={adicionarResponsavel} alunoId={id} rotuloBotao="Adicionar pessoa">
          <Campo className="c-4" rotulo="Nome completo" name="resp.nome" obrigatorio />
          <Campo className="c-2" rotulo="Parentesco" name="resp.parentesco" placeholder="Avó, Tio…" obrigatorio />
          <CampoSelect className="c-2" rotulo="Aparece na filiação como" name="resp.filiacao" defaultValue="">
            <option value="">Não aparece</option><option value="mae">Mãe</option><option value="pai">Pai</option>
          </CampoSelect>
          <Campo className="c-2" rotulo="CPF" name="resp.cpf" inputMode="numeric" />
          <Campo className="c-2" rotulo="Telefone" name="resp.telefone" inputMode="tel" />
          <Campo className="c-3" rotulo="E-mail" name="resp.email" type="email" />
          <Campo className="c-3" rotulo="Profissão" name="resp.profissao" />
          <div className="c-6" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
            <Check rotulo="Responsável legal" name="resp.responsavel_legal" />
            <Check rotulo="Responsável financeiro" name="resp.responsavel_financeiro" />
            <Check rotulo="Pode buscar a criança" name="resp.pode_buscar" defaultChecked />
            <Check rotulo="Contato de emergência" name="resp.contato_emergencia" />
          </div>
        </FormSecao>
      ) : null}

      {eSecretaria ? (
        <FormSecao titulo="3. Informações de saúde" acao={salvarSaude} alunoId={id} rotuloBotao="Salvar saúde">
          <CampoTexto className="c-3" rotulo="Problema de saúde" name="saude.problema_saude" rows={2} defaultValue={saude?.problema_saude ?? ''} />
          <CampoTexto className="c-3" rotulo="Alergias" name="saude.alergias" rows={2} defaultValue={saude?.alergias ?? ''} />
          <CampoTexto className="c-3" rotulo="Medicamento contínuo" name="saude.medicamento_continuo" rows={2} defaultValue={saude?.medicamento_continuo ?? ''} />
          <CampoTexto className="c-3" rotulo="Restrição alimentar" name="saude.restricao_alimentar" rows={2} defaultValue={saude?.restricao_alimentar ?? ''} />
          <Campo className="c-3" rotulo="Convênio médico" name="saude.convenio" defaultValue={saude?.convenio ?? ''} />
          <Campo className="c-3" rotulo="Nº da carteirinha" name="saude.convenio_carteirinha" defaultValue={saude?.convenio_carteirinha ?? ''} />
          <CampoTexto className="c-6" rotulo="Observações importantes" name="saude.observacoes" rows={2} defaultValue={saude?.observacoes ?? ''} />
          <Campo className="c-4" rotulo="Em caso de emergência, avisar" name="saude.emergencia_nome" defaultValue={saude?.emergencia_nome ?? ''} />
          <Campo className="c-2" rotulo="Telefone de emergência" name="saude.emergencia_telefone" defaultValue={formatarTelefone(saude?.emergencia_telefone)} />
        </FormSecao>
      ) : null}

      <FormSecao titulo="4. Atendimento especializado" acao={salvarAtendimento} alunoId={id} rotuloBotao="Salvar atendimento">
        <div className="c-6"><Check rotulo="Possui laudo ou necessidade especial" name="atendimento.possui_laudo" defaultChecked={atendimento?.possui_laudo} /></div>
        <CampoTexto className="c-6" rotulo="Qual(is)" name="atendimento.laudo_descricao" rows={2} defaultValue={atendimento?.laudo_descricao ?? ''} />
        <div className="c-6"><Check rotulo="Acompanha atendimento especializado" name="atendimento.acompanha_atendimento" defaultChecked={atendimento?.acompanha_atendimento} /></div>
        <CampoTexto className="c-6" rotulo="Qual atendimento" name="atendimento.atendimento_descricao" rows={2} defaultValue={atendimento?.atendimento_descricao ?? ''} />
        <CampoTexto className="c-6" rotulo="Observações pedagógicas relevantes" name="atendimento.observacoes_pedagogicas" rows={3} defaultValue={atendimento?.observacoes_pedagogicas ?? ''} />
      </FormSecao>

      {eSecretaria ? (
        <FormSecao titulo="6. Endereço do aluno" acao={salvarEndereco} alunoId={id} rotuloBotao="Salvar endereço">
          <Campo className="c-4" rotulo="Endereço" name="endereco.logradouro" defaultValue={endereco?.logradouro ?? ''} />
          <Campo className="c-1" rotulo="Nº" name="endereco.numero" defaultValue={endereco?.numero ?? ''} />
          <Campo className="c-1" rotulo="Complemento" name="endereco.complemento" defaultValue={endereco?.complemento ?? ''} />
          <Campo className="c-2" rotulo="Bairro" name="endereco.bairro" defaultValue={endereco?.bairro ?? ''} />
          <Campo className="c-2" rotulo="Cidade" name="endereco.cidade" defaultValue={endereco?.cidade ?? ''} />
          <Campo className="c-1" rotulo="UF" name="endereco.uf" maxLength={2} defaultValue={endereco?.uf ?? ''} />
          <Campo className="c-1" rotulo="CEP" name="endereco.cep" defaultValue={formatarCep(endereco?.cep)} />
          <Campo className="c-3" rotulo="Telefone residencial" name="endereco.telefone_residencial" defaultValue={formatarTelefone(endereco?.telefone_residencial)} />
          <Campo className="c-3" rotulo="Telefone celular" name="endereco.telefone_celular" defaultValue={formatarTelefone(endereco?.telefone_celular)} />
        </FormSecao>
      ) : null}
    </main>
  );
}
