import { describe, it, expect } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { RecomendacaoStrategy } from '../../src/strategies/RecomendacaoStrategy.js';
import { RecomendadorBase } from '../../src/decorators/RecomendadorBase.js';
import { CacheDecorator } from '../../src/decorators/CacheDecorator.js';
import { AuditoriaDecorator } from '../../src/decorators/AuditoriaDecorator.js';
import { CompressaoDecorator, serializarResultado } from '../../src/decorators/CompressaoDecorator.js';
import { PilhaDecoradores } from '../../src/decorators/PilhaDecoradores.js';
import { RegrasOrcamento } from '../../src/strategies/RegrasOrcamento.js';
import { SistemaRecomendacao } from '../../src/observers/SistemaRecomendacao.js';
import { OrquestradorPadrao } from '../../src/orchestration/OrquestradorPadrao.js';
import { Projeto } from '../../src/domain/entities/Projeto.js';
import { Profissional } from '../../src/domain/entities/Profissional.js';
import { Competencia } from '../../src/domain/entities/Competencia.js';
import { Papel } from '../../src/domain/enums/Papel.js';

const disp = { inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') };
const projeto = () => new Projeto('proj-dec', 'Ficção', 90, 100000, new Date('2026-12-01'), [Papel.DIRETOR, Papel.EDITOR]);

function profissionais(n: number): Profissional[] {
  return Array.from({ length: n }, (_, i) =>
    new Profissional(`p${i}`, `Profissional ${i}`, [new Competencia('Direção', 5), new Competencia('Edição', 6)], disp, 100 + i));
}

// Recomendador lento que conta quantas vezes foi realmente executado.
class RecomendadorLento implements RecomendacaoStrategy {
  chamadas = 0;
  constructor(private readonly atrasoMs: number) {}
  recomendar(p: Projeto, profs: Profissional[]) {
    this.chamadas += 1;
    const fim = performance.now() + this.atrasoMs;
    while (performance.now() < fim) { /* espera ocupada para simular custo */ }
    return new RegrasOrcamento().recomendar(p, profs);
  }
}

describe('Decorator — Cache', () => {
  it('requisição repetida não chama o recomendador interno e é mais rápida', () => {
    const lento = new RecomendadorLento(30);
    const cache = new CacheDecorator(lento);
    const profs = profissionais(5);

    const t0 = performance.now();
    const primeiro = cache.recomendar(projeto(), profs);
    const tPrimeira = performance.now() - t0;

    const t1 = performance.now();
    const segundo = cache.recomendar(projeto(), profs);
    const tSegunda = performance.now() - t1;

    expect(lento.chamadas).toBe(1);
    expect(cache.hits).toBe(1);
    expect(cache.misses).toBe(1);
    expect(tSegunda).toBeLessThan(tPrimeira);
    expect(serializarResultado(segundo)).toBe(serializarResultado(primeiro));
  });

  it('entradas diferentes geram novas consultas', () => {
    const lento = new RecomendadorLento(0);
    const cache = new CacheDecorator(lento);
    cache.recomendar(projeto(), profissionais(3));
    cache.recomendar(projeto(), profissionais(4));
    expect(lento.chamadas).toBe(2);
  });

  it('entradas expiram após o TTL', () => {
    let agora = 1000;
    const lento = new RecomendadorLento(0);
    const cache = new CacheDecorator(lento, { ttlMs: 500, agora: () => agora });
    const profs = profissionais(2);
    cache.recomendar(projeto(), profs);
    agora += 400;
    cache.recomendar(projeto(), profs);
    expect(lento.chamadas).toBe(1);
    agora += 200;
    cache.recomendar(projeto(), profs);
    expect(lento.chamadas).toBe(2);
  });

  it('devolve cópias: alterar o resultado não corrompe o cache', () => {
    const cache = new CacheDecorator(new RecomendadorBase(new RegrasOrcamento()));
    const profs = profissionais(3);
    const r1 = cache.recomendar(projeto(), profs);
    r1.get(Papel.DIRETOR)?.pop();
    const r2 = cache.recomendar(projeto(), profs);
    expect(r2.get(Papel.DIRETOR)).toHaveLength(3);
  });
});

describe('Decorator — Auditoria', () => {
  it('registra todas as chamadas com tempo e resultado', () => {
    const auditoria = new AuditoriaDecorator(new RecomendadorBase(new RegrasOrcamento()));
    auditoria.recomendar(projeto(), profissionais(3));
    auditoria.recomendar(projeto(), profissionais(4));

    expect(auditoria.registros).toHaveLength(2);
    expect(auditoria.registros[0]?.projetoId).toBe('proj-dec');
    expect(auditoria.registros[0]?.candidatosEntrada).toBe(3);
    expect(auditoria.registros[1]?.candidatosEntrada).toBe(4);
    expect(auditoria.registros[0]?.sucesso).toBe(true);
    expect(auditoria.registros[0]?.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it('registra falhas e repropaga o erro', () => {
    const quebrado: RecomendacaoStrategy = { recomendar: () => { throw new Error('boom'); } };
    const auditoria = new AuditoriaDecorator(quebrado);
    expect(() => auditoria.recomendar(projeto(), [])).toThrow();
    expect(auditoria.registros[0]?.sucesso).toBe(false);
    expect(auditoria.registros[0]?.erro).toBe('boom');
  });
});

describe('Decorator — Compressão', () => {
  it('reduz o volume de dados transmitidos', () => {
    const compressao = new CompressaoDecorator(new RecomendadorBase(new RegrasOrcamento()), 2);
    const resultado = compressao.recomendar(projeto(), profissionais(20));

    expect(resultado.get(Papel.DIRETOR)).toHaveLength(2);
    const relatorio = compressao.ultimoRelatorio!;
    expect(relatorio.bytesDepois).toBeLessThan(relatorio.bytesAntes);
    expect(relatorio.bytesGzip).toBeLessThan(relatorio.bytesDepois);
  });

  it('o gzip gerado para transmissão é reversível', () => {
    const compressao = new CompressaoDecorator(new RecomendadorBase(new RegrasOrcamento()), 3);
    const resultado = compressao.recomendar(projeto(), profissionais(10));
    const original = serializarResultado(resultado);
    expect(gunzipSync(compressao.comprimirParaTransmissao(resultado)).toString()).toBe(original);
  });

  it('rejeita limite inválido', () => {
    expect(() => new CompressaoDecorator(new RecomendadorBase(), 0)).toThrow();
  });
});

describe('Decorator — combinação em diferentes ordens, sem alterar o recomendador base', () => {
  it('cache -> auditoria -> compressão', () => {
    const lento = new RecomendadorLento(0);
    const auditoria = new AuditoriaDecorator(new CacheDecorator(lento));
    const compressao = new CompressaoDecorator(auditoria, 2);
    const profs = profissionais(8);

    const r1 = compressao.recomendar(projeto(), profs);
    compressao.recomendar(projeto(), profs);

    expect(lento.chamadas).toBe(1);          // cache evitou a segunda execução
    expect(auditoria.registros).toHaveLength(2); // auditoria viu as duas chamadas
    expect(r1.get(Papel.DIRETOR)).toHaveLength(2); // compressão reduziu a saída
  });

  it('compressão -> auditoria -> cache: a ordem muda o comportamento observável', () => {
    const lento = new RecomendadorLento(0);
    const auditoria = new AuditoriaDecorator(new CompressaoDecorator(lento, 2));
    const cache = new CacheDecorator(auditoria);
    const profs = profissionais(8);

    cache.recomendar(projeto(), profs);
    cache.recomendar(projeto(), profs);

    expect(lento.chamadas).toBe(1);
    expect(auditoria.registros).toHaveLength(1); // aqui o cache fica por fora e esconde a 2ª chamada da auditoria
  });
});

describe('Decorator — pilha dinâmica configurada em tempo de execução', () => {
  it('monta a pilha a partir de texto e a aplica no SistemaRecomendacao sem alterá-lo', () => {
    const sistema = new SistemaRecomendacao(new OrquestradorPadrao(), new RegrasOrcamento());
    const pilha = PilhaDecoradores.deTexto('cache,auditoria,compressao', { maximoCandidatosPorPapel: 1 });
    sistema.definirDecoradores((estrategia) => pilha.aplicar(new RecomendadorBase(estrategia)));

    const profs = profissionais(5);
    const equipe1 = sistema.executarRecomendacao(projeto(), profs);
    const equipe2 = sistema.executarRecomendacao(projeto(), profs);

    expect(equipe1.membros).toHaveLength(2);
    expect(equipe2.membros[0]?.profissional.id).toBe(equipe1.membros[0]?.profissional.id);
    expect(pilha.registrosAuditoria).toHaveLength(2);
  });

  it('a política pode ser trocada em runtime (inclusive removida)', () => {
    const sistema = new SistemaRecomendacao(new OrquestradorPadrao(), new RegrasOrcamento());
    const so_auditoria = PilhaDecoradores.deTexto('auditoria');
    sistema.definirDecoradores((e) => so_auditoria.aplicar(e));
    sistema.executarRecomendacao(projeto(), profissionais(3));
    expect(so_auditoria.registrosAuditoria).toHaveLength(1);

    sistema.definirDecoradores(undefined);
    sistema.executarRecomendacao(projeto(), profissionais(3));
    expect(so_auditoria.registrosAuditoria).toHaveLength(1);
  });

  it('o cache da pilha não mistura resultados de estratégias diferentes', () => {
    const sistema = new SistemaRecomendacao(new OrquestradorPadrao(), new RegrasOrcamento());
    const pilha = PilhaDecoradores.deTexto('cache');
    sistema.definirDecoradores((e) => pilha.aplicar(e));
    const profs = profissionais(3);

    expect(sistema.executarRecomendacao(projeto(), profs).membros).toHaveLength(2);
    sistema.definirEstrategia({ recomendar: () => new Map() });
    expect(sistema.executarRecomendacao(projeto(), profs).membros).toHaveLength(0);
  });

  it('rejeita decorador desconhecido', () => {
    expect(() => PilhaDecoradores.deTexto('cache,foo')).toThrow();
  });
});
