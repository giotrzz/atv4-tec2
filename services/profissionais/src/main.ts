import Fastify from 'fastify';
import { conectarBanco, bancoSaudavel } from './db.js';
import { conectarRabbit, consumir } from './rabbit.js';
import { registrarHealth } from './health.js';
import { criarSchema, semear, listar, inserir, ProfissionalDTO } from './repositorio.js';

const FILA_CONSULTA = 'consulta-profissionais';

async function iniciar() {
  const porta = Number(process.env.PORT ?? 3001);
  const pool = await conectarBanco(process.env.DATABASE_URL!);
  await criarSchema(pool);
  await semear(pool);
  const rabbit = await conectarRabbit(process.env.RABBITMQ_URL!);

  // Consumidor RPC: responde na fila indicada em replyTo, com o mesmo correlationId.
  await consumir(rabbit.canal, FILA_CONSULTA, async (corpo, msg) => {
    const { replyTo, correlationId } = msg.properties;
    let resposta: unknown;
    try {
      resposta = { profissionais: await listar(pool, corpo?.criterios ?? {}) };
    } catch (erro) {
      resposta = { erro: erro instanceof Error ? erro.message : 'erro ao consultar profissionais' };
    }
    if (replyTo) {
      rabbit.canal.sendToQueue(replyTo, Buffer.from(JSON.stringify(resposta)), { correlationId, contentType: 'application/json' });
    }
  });
  console.log(`[profissionais] consumindo a fila "${FILA_CONSULTA}"`);

  const app = Fastify();
  registrarHealth(app, { postgres: () => bancoSaudavel(pool), rabbitmq: () => rabbit.saudavel() });

  app.get('/profissionais', async () => listar(pool));
  app.post<{ Body: ProfissionalDTO }>('/profissionais', async (req, reply) => {
    const p = req.body;
    if (!p?.id || !p?.nome || !p?.disponibilidade || typeof p.precoMedio !== 'number') {
      return reply.status(400).send({ erro: 'Campos obrigatórios: id, nome, disponibilidade, precoMedio.' });
    }
    await inserir(pool, { ...p, competencias: p.competencias ?? [], avaliacoes: p.avaliacoes ?? [] });
    return reply.status(201).send({ id: p.id });
  });

  await app.listen({ port: porta, host: '0.0.0.0' });
  console.log(`cinebridge-profissionais rodando na porta ${porta}`);
}

iniciar().catch((erro) => { console.error(erro); process.exit(1); });
