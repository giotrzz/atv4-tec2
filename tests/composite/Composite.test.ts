import { describe, it, expect } from 'vitest';
import { ServicoAtomico } from '../../src/composite/ServicoAtomico.js';
import { PacoteServico } from '../../src/composite/PacoteServico.js';
import { Projeto } from '../../src/domain/entities/Projeto.js';
import { ProjetoDocumentario } from '../../src/domain/entities/ProjetosEspecializados.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { OrquestradorPadrao } from '../../src/orchestration/OrquestradorPadrao.js';
import { RegrasOrcamento } from '../../src/strategies/RegrasOrcamento.js';
import { ValidadorConsistencia } from '../../src/visitors/ValidadorConsistencia.js';

const edicao = () => new ServicoAtomico('Edição', 3000, 10, Papel.EDITOR);
const coloracao = () => new ServicoAtomico('Coloração', 2000, 5, Papel.DIRETOR_FOTOGRAFIA);
const mixagem = () => new ServicoAtomico('Mixagem', 1500, 4, Papel.SONOPLASTA);
const vfx = () => new ServicoAtomico('VFX', 5000, 20, Papel.EFEITOS_VISUAIS);

describe('Composite — cálculo de custos e prazos', () => {
  it('serviço atômico responde por si mesmo', () => {
    const s = edicao();
    expect(s.calcularCusto()).toBe(3000);
    expect(s.obterPrazo()).toBe(10);
    expect(s.listarSubservicos()).toHaveLength(0);
    expect(s.validar()).toBe(true);
  });

  it('pacote simples (1 nível) soma custos e prazos sequenciais', () => {
    const pacote = new PacoteServico('Pós-produção', [edicao(), coloracao(), mixagem()]);
    expect(pacote.calcularCusto()).toBe(6500);
    expect(pacote.obterPrazo()).toBe(19);
    expect(pacote.listarSubservicos()).toHaveLength(3);
  });

  it('pacote em paralelo usa o maior prazo', () => {
    const pacote = new PacoteServico('Pós em paralelo', [edicao(), coloracao(), mixagem()], 'paralelo');
    expect(pacote.obterPrazo()).toBe(10);
    expect(pacote.calcularCusto()).toBe(6500);
  });

  it('hierarquia profunda (3 níveis) propaga recursivamente', () => {
    const audio = new PacoteServico('Áudio', [mixagem(), new ServicoAtomico('Foley', 500, 3, Papel.SONOPLASTA)]);
    const pos = new PacoteServico('Pós', [edicao(), audio]);
    const producao = new PacoteServico('Produção completa', [vfx(), pos], 'sequencial');

    expect(producao.calcularCusto()).toBe(5000 + 3000 + 1500 + 500);
    expect(producao.obterPrazo()).toBe(20 + 10 + 4 + 3);
    expect(producao.obterPapeis().sort()).toEqual([Papel.EDITOR, Papel.EFEITOS_VISUAIS, Papel.SONOPLASTA].sort());
  });

  it('pacotes e serviços atômicos são tratados pela mesma interface', () => {
    const lista = [edicao(), new PacoteServico('P', [coloracao()])];
    expect(lista.map((s) => s.calcularCusto())).toEqual([3000, 2000]);
  });
});

describe('Composite — validação recursiva', () => {
  it('detecta serviço atômico inválido em qualquer profundidade', () => {
    const invalido = new ServicoAtomico('Ruim', -1, 5, Papel.EDITOR);
    const semPrazo = new ServicoAtomico('Sem prazo', 10, 0, Papel.EDITOR);
    const papelInvalido = new ServicoAtomico('Papel', 10, 1, 'INEXISTENTE' as Papel);
    const profundo = new PacoteServico('Raiz', [new PacoteServico('Meio', [new PacoteServico('Folha', [invalido])])]);

    expect(profundo.validar()).toBe(false);
    expect(semPrazo.validar()).toBe(false);
    expect(papelInvalido.validar()).toBe(false);
  });

  it('pacote vazio é inválido', () => {
    expect(new PacoteServico('Vazio').validar()).toBe(false);
    expect(new PacoteServico('Ok', [edicao()]).validar()).toBe(true);
  });

  it('impede ciclos na hierarquia', () => {
    const a = new PacoteServico('A', [edicao()]);
    const b = new PacoteServico('B', [a]);
    expect(() => a.adicionar(b)).toThrow();
    expect(() => a.adicionar(a)).toThrow();
  });

  it('adicionar e remover subserviços', () => {
    const pacote = new PacoteServico('P');
    const s = edicao();
    pacote.adicionar(s);
    expect(pacote.listarSubservicos()).toHaveLength(1);
    expect(pacote.remover(s)).toBe(true);
    expect(pacote.remover(s)).toBe(false);
  });
});

describe('Composite — integração com Projeto', () => {
  const prazo = new Date('2026-12-01');

  it('calcularCustoTotal delega ao servicoPrincipal', () => {
    const principal = new PacoteServico('Tudo', [edicao(), new PacoteServico('Áudio', [mixagem()])]);
    const projeto = new Projeto('p1', 'ficcao', 90, 10000, prazo, [], {}, principal);

    expect(projeto.calcularCustoTotal()).toBe(4500);
    expect(projeto.obterPrazoTotalDias()).toBe(14);
    expect(projeto.validarEstrutura()).toBe(true);
    expect(projeto.papeisObrigatorios.sort()).toEqual([Papel.EDITOR, Papel.SONOPLASTA].sort());
  });

  it('projeto antigo (lista de papéis, sem hierarquia) continua funcionando', () => {
    const projeto = new Projeto('p2', 'ficcao', 90, 10000, prazo, [Papel.DIRETOR]);
    expect(projeto.calcularCustoTotal()).toBe(0);
    expect(projeto.validarEstrutura()).toBe(true);
  });

  it('clonar copia a hierarquia de forma independente (inclusive em tipos especializados)', () => {
    const principal = new PacoteServico('Tudo', [edicao()]);
    const doc = new ProjetoDocumentario('d1', 60, 5000, prazo, [Papel.EDITOR], { entrevistas: true }, principal);
    const copia = doc.clonar();

    expect(copia).toBeInstanceOf(ProjetoDocumentario);
    expect(copia.servicoPrincipal).not.toBe(principal);
    principal.adicionar(mixagem());
    expect(copia.calcularCustoTotal()).toBe(3000);
    expect(doc.calcularCustoTotal()).toBe(4500);
  });

  it('o orquestrador rejeita projeto com estrutura de serviços inválida', () => {
    const invalido = new PacoteServico('Raiz', [new ServicoAtomico('Ruim', -5, 1, Papel.EDITOR)]);
    const projeto = new Projeto('p3', 'ficcao', 90, 10000, prazo, [Papel.EDITOR], {}, invalido);

    expect(() => new OrquestradorPadrao().orquestrar(projeto, new RegrasOrcamento(), [])).toThrow();
    expect(projeto.aceita(new ValidadorConsistencia())).toBe(false);
  });
});
