import { describe, it, expect } from 'vitest';
import { criarApp } from '../../src/app.js';
import { Mensageria, RecomendacaoGeradaMensagem, ErroMensageria } from '../../src/http/rotas.js';
import { ProfissionalDTO } from '../../src/http/DTOs.js';

const profissional: ProfissionalDTO = {
  id: 'mq-1', nome: 'Via Fila', competencias: [],
  disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2026-12-31T00:00:00.000Z' }, precoMedio: 1000,
};

function projetoValido() {
  return { id: 'proj-mq', genero: 'Ficção', duracao: 90, orcamento: 10000, prazo: '2026-12-01T00:00:00.000Z', papeisObrigatorios: ['DIRETOR'] };
}

class MensageriaFalsa implements Mensageria {
  publicadas: RecomendacaoGeradaMensagem[] = [];
  consultas = 0;
  conectada = true;
  falharPublicacao = false;
  falharConsulta = false;
  async consultarProfissionais() {
    this.consultas += 1;
    if (this.falharConsulta) throw new ErroMensageria('timeout');
    return [profissional];
  }
  async publicarRecomendacao(m: RecomendacaoGeradaMensagem) {
    if (this.falharPublicacao) throw new Error('broker fora');
    this.publicadas.push(m);
  }
  saudavel() { return this.conectada; }
}

describe('API com mensageria (ATV4) — usando um broker falso', () => {
  it('consulta profissionais pela fila quando não vêm no corpo e publica a recomendação', async () => {
    const mq = new MensageriaFalsa();
    const app = criarApp({ mensageria: mq });
    const resposta = await app.inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido() } });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().membros[0].profissionalId).toBe('mq-1');
    expect(mq.consultas).toBe(1);
    expect(mq.publicadas).toHaveLength(1);
    expect(mq.publicadas[0]?.projeto.id).toBe('proj-mq');
  });

  it('não consulta a fila quando os profissionais vêm no corpo', async () => {
    const mq = new MensageriaFalsa();
    const app = criarApp({ mensageria: mq });
    await app.inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido(), profissionais: [profissional] } });
    expect(mq.consultas).toBe(0);
  });

  it('falha na publicação não derruba a resposta ao cliente', async () => {
    const mq = new MensageriaFalsa();
    mq.falharPublicacao = true;
    const resposta = await criarApp({ mensageria: mq }).inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido() } });
    expect(resposta.statusCode).toBe(200);
  });

  it('retorna 503 quando a consulta de profissionais pela fila falha', async () => {
    const mq = new MensageriaFalsa();
    mq.falharConsulta = true;
    const resposta = await criarApp({ mensageria: mq }).inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido() } });
    expect(resposta.statusCode).toBe(503);
  });

  it('sem mensageria e sem profissionais no corpo retorna 400', async () => {
    const resposta = await criarApp().inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido() } });
    expect(resposta.statusCode).toBe(400);
  });

  it('GET /health reflete a conexão com o RabbitMQ', async () => {
    const mq = new MensageriaFalsa();
    const app = criarApp({ mensageria: mq });
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    mq.conectada = false;
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(503);
  });

  it('a pilha de decoradores pode ser ativada pela configuração da aplicação', async () => {
    const app = criarApp({ decoradores: 'cache,auditoria,compressao' });
    const resposta = await app.inject({ method: 'POST', url: '/recomendacoes', payload: { projeto: projetoValido(), profissionais: [profissional] } });
    expect(resposta.statusCode).toBe(200);
  });
});
