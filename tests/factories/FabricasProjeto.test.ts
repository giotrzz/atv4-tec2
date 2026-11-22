import { describe, it, expect } from 'vitest';
import { ProjetoDocumentario, ProjetoAnimacao, ProjetoPublicitario } from '../../src/domain/entities/ProjetosEspecializados.js';
import { FabricaDocumentario, FabricaAnimacao, FabricaPublicitario, selecionarFabrica } from '../../src/factories/FabricasConcretas.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { Projeto } from '../../src/domain/entities/Projeto.js';
import { OrquestradorPadrao } from '../../src/orchestration/OrquestradorPadrao.js';
import { SistemaRecomendacao } from '../../src/observers/SistemaRecomendacao.js';
import { RegrasOrcamento } from '../../src/strategies/RegrasOrcamento.js';
import { Profissional } from '../../src/domain/entities/Profissional.js';

const prazo = new Date('2027-01-01T00:00:00Z');
describe('Prototype e fábricas Cinebridge (integração)', () => {
  it('clona profundamente projeto, papéis, restrições e data', () => {
    const original = new ProjetoAnimacao('a1', 90, 20000, prazo);
    const copia = original.clonar();
    copia.papeisObrigatorios.push(Papel.EDITOR);
    (copia.restricoes as Record<string, unknown>).renderizacao3D = false;
    expect(copia).not.toBe(original);
    expect(copia.papeisObrigatorios).not.toBe(original.papeisObrigatorios);
    expect(original.papeisObrigatorios).not.toContain(Papel.EDITOR);
    expect(original.restricoes.renderizacao3D).toBe(true);
    expect(copia.prazo).not.toBe(original.prazo);
  });
  it.each([
    [new FabricaDocumentario(), ProjetoDocumentario, 'documentario'],
    [new FabricaAnimacao(), ProjetoAnimacao, 'animacao'],
    [new FabricaPublicitario(), ProjetoPublicitario, 'publicitario'],
  ])('cria a família consistente para %s', (fabrica, Classe, genero) => {
    const modelo = new Projeto('p1', genero, 60, 10000, prazo, [Papel.DIRETOR]);
    const projeto = fabrica.criarProjeto(modelo);
    expect(projeto).toBeInstanceOf(Classe);
    expect(projeto.genero).toBe(genero);
    expect(fabrica.criarValidador().validar(projeto)).toBe(true);
    expect(fabrica.criarRecomendador()).toBeDefined();
    expect(fabrica.criarNotificador()).toBeDefined();
  });
  it('seleciona a fábrica pelo gênero e recomenda sem alterar o orquestrador', () => {
    const sistema = new SistemaRecomendacao(new OrquestradorPadrao(), new RegrasOrcamento());
    const projeto = new Projeto('p2', 'documentario', 60, 10000, prazo, [Papel.DIRETOR]);
    const profissional = new Profissional('prof1', 'Ana', [], {inicio: new Date('2026-01-01'), fim: new Date('2028-01-01')}, 1000);
    const equipe = sistema.executarRecomendacao(projeto, [profissional]);
    expect(equipe.membros).toHaveLength(1);
    expect(selecionarFabrica('animação').criarValidador().validar(
      new ProjetoAnimacao('a2', 30, 5000, prazo)
    )).toBe(true);
  });
});
