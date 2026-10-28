'use client';

import { useState, type ReactNode } from 'react';
import { buscarResponsaveis, type ResponsavelEncontrado } from '@/app/(escola)/alunos/actions';
import { Botao, Campo } from '@/components/ui';
import { CampoCpf, CampoRg, CampoTelefone } from '@/components/campo-mascara';
import { formatarCpf, formatarTelefone } from '@/lib/formatos';

function juntar(nomes: string[]) {
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

function resumo(p: ResponsavelEncontrado) {
  return [p.cpf ? `CPF ${formatarCpf(p.cpf)}` : null, p.telefone ? formatarTelefone(p.telefone) : null, p.email].filter(Boolean).join(' · ');
}

/**
 * Dados pessoais de um responsável, com busca de quem já está cadastrado.
 * Pai/mãe de mais de uma criança é UMA pessoa só: ao digitar o nome ou o CPF,
 * a secretaria vê quem já existe e escolhe "Usar este cadastro". Os dados
 * pessoais passam a valer para todas as crianças; o que muda por criança
 * (parentesco, filiação, quem busca…) vem em `children`.
 */
export function DadosResponsavel({ prefixo, comRg = true, children }: { prefixo: string; comRg?: boolean; children?: ReactNode }) {
  const [existente, setExistente] = useState<ResponsavelEncontrado | null>(null);
  const [sugestoes, setSugestoes] = useState<ResponsavelEncontrado[]>([]);
  const [descartados, setDescartados] = useState<string[]>([]);

  async function buscar(valor: string) {
    const v = valor.trim();
    const digitos = v.replace(/\D/g, '');
    if (digitos.length !== 11 && v.replace(/\s/g, '').length < 3) return;
    const achados = await buscarResponsaveis(v);
    setSugestoes(achados.filter((a) => !descartados.includes(a.id)));
  }

  if (existente) {
    return (
      <>
        <input type="hidden" name={`${prefixo}.pessoa_id`} value={existente.id} />
        <input type="hidden" name={`${prefixo}.nome`} value={existente.nome} />
        <div className="c-6 resp-existente">
          <div className="cresce">
            <div style={{ fontWeight: 600 }}>{existente.nome}</div>
            {resumo(existente) ? <div className="legenda">{resumo(existente)}</div> : null}
            <div className="legenda">
              Cadastro já existente{existente.criancas.length ? ` — também responsável por ${juntar(existente.criancas)}` : ''}.
              Os dados pessoais são os mesmos para todas as crianças.
            </div>
          </div>
          <Botao variante="texto" tamanho="sm" onClick={() => { setDescartados([...descartados, existente.id]); setExistente(null); }}>
            Não é esta pessoa
          </Botao>
        </div>
        {children}
      </>
    );
  }

  return (
    <>
      <Campo className="c-4" rotulo="Nome completo" name={`${prefixo}.nome`} obrigatorio autoComplete="off"
        onBlur={(e) => buscar(e.currentTarget.value)} />
      <CampoCpf className="c-2" rotulo="CPF" name={`${prefixo}.cpf`} onBlur={(e) => buscar(e.currentTarget.value)} />
      {sugestoes.length ? (
        <div className="c-6 resp-sugestoes" role="status">
          <p style={{ margin: 0, fontWeight: 600 }}>Já cadastrado na escola? Use o mesmo cadastro para ligar esta pessoa a todos os filhos.</p>
          <ul>
            {sugestoes.map((s) => (
              <li key={s.id}>
                <div className="cresce">
                  <div style={{ fontWeight: 600 }}>{s.nome}</div>
                  <div className="legenda">
                    {[s.criancas.length ? `responsável por ${juntar(s.criancas)}` : null, resumo(s)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Botao tamanho="sm" onClick={() => { setExistente(s); setSugestoes([]); }}>Usar este cadastro</Botao>
              </li>
            ))}
          </ul>
          <Botao variante="texto" tamanho="sm" onClick={() => { setDescartados([...descartados, ...sugestoes.map((s) => s.id)]); setSugestoes([]); }}>
            Não é nenhuma destas pessoas
          </Botao>
        </div>
      ) : null}
      {children}
      {comRg ? <CampoRg className="c-2" rotulo="RG" name={`${prefixo}.rg`} /> : null}
      <CampoTelefone className="c-2" rotulo="Telefone" name={`${prefixo}.telefone`} />
      <Campo className="c-2" rotulo="E-mail" name={`${prefixo}.email`} type="email" />
      <Campo className="c-2" rotulo="Profissão" name={`${prefixo}.profissao`} />
    </>
  );
}
