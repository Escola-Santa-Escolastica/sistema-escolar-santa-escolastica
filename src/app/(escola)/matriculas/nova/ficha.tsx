'use client';

import { useActionState, useState, startTransition, type FormEvent } from 'react';
import { criarMatricula, type EstadoForm } from '../actions';
import { Aviso, Botao, Campo, CampoSelect, CampoTexto, Check } from '@/components/ui';
import { CORES_RACA, TURNOS } from '@/lib/formatos';

type Etapa = { id: string; nome: string };

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="painel bloco">
      <legend className="secao-titulo" style={{ float: 'left', width: '100%', marginBottom: 16 }}>
        {numero}. {titulo}
      </legend>
      <div className="form-grade" style={{ clear: 'both' }}>{children}</div>
    </fieldset>
  );
}

function Responsavel({ indice, onRemover, padrao }: { indice: number; onRemover?: () => void; padrao: 'mae' | 'pai' | 'outro' }) {
  const p = `resp.${indice}`;
  return (
    <div className="bloco-responsavel c-6">
      <div className="form-grade">
        <Campo className="c-4" rotulo="Nome completo" name={`${p}.nome`} obrigatorio autoComplete="off" />
        <Campo className="c-2" rotulo="Parentesco" name={`${p}.parentesco`} obrigatorio
          defaultValue={padrao === 'mae' ? 'Mãe' : padrao === 'pai' ? 'Pai' : ''} placeholder="Mãe, Pai, Avó…" />
        <CampoSelect className="c-2" rotulo="Aparece na filiação como" name={`${p}.filiacao`} defaultValue={padrao === 'outro' ? '' : padrao}>
          <option value="">Não aparece</option>
          <option value="mae">Mãe</option>
          <option value="pai">Pai</option>
        </CampoSelect>
        <Campo className="c-2" rotulo="CPF" name={`${p}.cpf`} inputMode="numeric" placeholder="000.000.000-00" />
        <Campo className="c-2" rotulo="RG" name={`${p}.rg`} />
        <Campo className="c-2" rotulo="Telefone" name={`${p}.telefone`} inputMode="tel" placeholder="(37) 99999-9999" />
        <Campo className="c-2" rotulo="E-mail" name={`${p}.email`} type="email" />
        <Campo className="c-2" rotulo="Profissão" name={`${p}.profissao`} />
        <div className="c-6" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
          <Check rotulo="Responsável legal" name={`${p}.responsavel_legal`} defaultChecked={padrao !== 'outro'} />
          <Check rotulo="Responsável financeiro" name={`${p}.responsavel_financeiro`} defaultChecked={indice === 0} />
          <Check rotulo="Pode buscar a criança" name={`${p}.pode_buscar`} defaultChecked />
          <Check rotulo="Contato de emergência" name={`${p}.contato_emergencia`} />
        </div>
        {onRemover ? (
          <div className="c-6"><Botao variante="texto" tamanho="sm" onClick={onRemover}>Remover esta pessoa</Botao></div>
        ) : null}
      </div>
    </div>
  );
}

export function FichaMatricula({ etapas, ano }: { etapas: Etapa[]; ano: number }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarMatricula, {});
  const [resps, setResps] = useState<{ id: number; padrao: 'mae' | 'pai' | 'outro' }[]>([
    { id: 0, padrao: 'mae' },
    { id: 1, padrao: 'pai' },
  ]);
  const [proximo, setProximo] = useState(2);
  const [laudo, setLaudo] = useState(false);

  // Envio manual: assim o formulário não é limpo quando volta um erro.
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => acao(dados));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}

      <Secao numero={1} titulo="Identificação do aluno">
        <Campo className="c-4" rotulo="Nome completo" name="aluno.nome" obrigatorio autoComplete="off" />
        <Campo className="c-2" rotulo="Nome social" name="aluno.nome_social" />
        <Campo className="c-2" rotulo="Data de nascimento" name="aluno.data_nascimento" type="date" obrigatorio />
        <Campo className="c-2" rotulo="Naturalidade" name="aluno.naturalidade" placeholder="Itapecerica/MG" />
        <Campo className="c-2" rotulo="Nacionalidade" name="aluno.nacionalidade" defaultValue="Brasileira" />
        <CampoSelect className="c-2" rotulo="Sexo" name="aluno.sexo" defaultValue="">
          <option value="">Não informado</option>
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
        </CampoSelect>
        <CampoSelect className="c-2" rotulo="Cor/Raça" name="aluno.cor_raca" defaultValue="" dica="Pedido pelo Censo Escolar.">
          <option value="">Não informado</option>
          {Object.entries(CORES_RACA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </CampoSelect>
        <div className="c-2 lado-a-lado">
          <CampoSelect rotulo="Tipo sanguíneo" name="aluno.tipo_sanguineo" defaultValue="">
            <option value="">—</option>
            {['A', 'B', 'AB', 'O'].map((t) => <option key={t}>{t}</option>)}
          </CampoSelect>
          <CampoSelect rotulo="Fator RH" name="aluno.fator_rh" defaultValue="">
            <option value="">—</option>
            <option value="+">+</option>
            <option value="-">−</option>
          </CampoSelect>
        </div>
        <Campo className="c-2" rotulo="CPF" name="aluno.cpf" inputMode="numeric" placeholder="000.000.000-00" />
        <Campo className="c-2" rotulo="Carteira de Identidade Nacional (CIN)" name="aluno.cin" />
        <Campo className="c-2" rotulo="RG" name="aluno.rg" />
        <Campo className="c-2" rotulo="Órgão Expedidor/Estado" name="aluno.rg_orgao_expedidor" placeholder="SSP/MG" />
        <Campo className="c-2" rotulo="Data de emissão do RG" name="aluno.rg_data_emissao" type="date" />
        <Campo className="c-3" rotulo="Nº do SUS (se possuir)" name="aluno.numero_sus" inputMode="numeric" />
        <Campo className="c-3" rotulo="NIS (se possuir)" name="aluno.nis" inputMode="numeric" />
      </Secao>

      <Secao numero={2} titulo="Filiação e responsáveis">
        <p className="legenda c-6" style={{ margin: 0 }}>
          Cadastre pai, mãe, responsável legal e quem mais pode buscar a criança. Pessoas já cadastradas (irmãos na escola)
          são reconhecidas pelo CPF.
        </p>
        {resps.map((r, i) => (
          <Responsavel key={r.id} indice={r.id} padrao={r.padrao}
            onRemover={i > 0 ? () => setResps(resps.filter((x) => x.id !== r.id)) : undefined} />
        ))}
        <div className="c-6">
          <Botao onClick={() => { setResps([...resps, { id: proximo, padrao: 'outro' }]); setProximo(proximo + 1); }}>
            Adicionar outra pessoa
          </Botao>
        </div>
      </Secao>

      <Secao numero={3} titulo="Informações de saúde">
        <CampoTexto className="c-3" rotulo="Problema de saúde" name="saude.problema_saude" rows={2} dica="Deixe em branco se não houver." />
        <CampoTexto className="c-3" rotulo="Alergias" name="saude.alergias" rows={2} dica="Aparece como alerta para quem cuida da criança." />
        <CampoTexto className="c-3" rotulo="Medicamento contínuo" name="saude.medicamento_continuo" rows={2} dica="Nome, dose e horário." />
        <CampoTexto className="c-3" rotulo="Restrição alimentar" name="saude.restricao_alimentar" rows={2} />
        <Campo className="c-3" rotulo="Convênio médico" name="saude.convenio" />
        <Campo className="c-3" rotulo="Nº da carteirinha" name="saude.convenio_carteirinha" />
        <CampoTexto className="c-6" rotulo="Observações importantes sobre a saúde do aluno" name="saude.observacoes" rows={2} />
        <Campo className="c-4" rotulo="Em caso de emergência, avisar" name="saude.emergencia_nome" />
        <Campo className="c-2" rotulo="Telefone de emergência" name="saude.emergencia_telefone" inputMode="tel" />
      </Secao>

      <Secao numero={4} titulo="Dados escolares">
        <CampoSelect className="c-2" rotulo={`Etapa pretendida (${ano})`} name="matricula.etapa_id" obrigatorio defaultValue="">
          <option value="" disabled>Escolha</option>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </CampoSelect>
        <CampoSelect className="c-2" rotulo="Turno" name="matricula.turno_pretendido" obrigatorio defaultValue="">
          <option value="" disabled>Escolha</option>
          {Object.entries(TURNOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </CampoSelect>
        <Campo className="c-2" rotulo="Último ano/série cursado" name="matricula.ultimo_ano_cursado" />
        <Campo className="c-6" rotulo="Instituição de origem" name="matricula.instituicao_origem" dica="Deixe em branco se for a primeira escola." />
        <div className="c-6"><Check rotulo="Possui laudo ou necessidade especial" name="atendimento.possui_laudo" checked={laudo} onChange={(e) => setLaudo(e.target.checked)} /></div>
        {laudo ? <CampoTexto className="c-6" rotulo="Qual(is)" name="atendimento.laudo_descricao" rows={2} /> : null}
        <div className="c-6"><Check rotulo="Acompanha atendimento especializado" name="atendimento.acompanha_atendimento" /></div>
        <CampoTexto className="c-6" rotulo="Qual atendimento" name="atendimento.atendimento_descricao" rows={2} />
        <CampoTexto className="c-6" rotulo="Observações pedagógicas relevantes" name="atendimento.observacoes_pedagogicas" rows={2} />
      </Secao>

      <Secao numero={5} titulo="Convênios e transporte">
        <div className="c-6" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
          <Check rotulo="Usa transporte escolar" name="aluno.transporte_escolar" />
          <Check rotulo="Recebe Bolsa Família" name="aluno.bolsa_familia" />
          <Check rotulo="Participa do Ensino Religioso" name="aluno.ensino_religioso" defaultChecked />
        </div>
        <Campo className="c-6" rotulo="Motivo da dispensa de Educação Física" name="aluno.dispensa_educacao_fisica" dica="Deixe em branco se não houver dispensa." />
      </Secao>

      <Secao numero={6} titulo="Endereço do aluno">
        <Campo className="c-4" rotulo="Endereço" name="endereco.logradouro" autoComplete="street-address" />
        <Campo className="c-1" rotulo="Nº" name="endereco.numero" />
        <Campo className="c-1" rotulo="Complemento" name="endereco.complemento" />
        <Campo className="c-2" rotulo="Bairro" name="endereco.bairro" />
        <Campo className="c-2" rotulo="Cidade" name="endereco.cidade" defaultValue="Itapecerica" />
        <Campo className="c-1" rotulo="UF" name="endereco.uf" defaultValue="MG" maxLength={2} />
        <Campo className="c-1" rotulo="CEP" name="endereco.cep" inputMode="numeric" placeholder="35550-000" />
        <Campo className="c-3" rotulo="Telefone residencial" name="endereco.telefone_residencial" inputMode="tel" />
        <Campo className="c-3" rotulo="Telefone celular" name="endereco.telefone_celular" inputMode="tel" />
      </Secao>

      <section className="painel" aria-labelledby="t-declaracao">
        <h2 id="t-declaracao" className="secao-titulo" style={{ marginBottom: 8 }}>7. Declaração</h2>
        <p style={{ margin: 0 }}>
          A família assina a declaração da Ficha Individual no papel. A matrícula entra como <strong>Em análise</strong> e
          o checklist de documentos é criado automaticamente.
        </p>
      </section>

      <div className="rodape-form">
        <Botao type="submit" variante="primario" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar matrícula'}</Botao>
      </div>
    </form>
  );
}
