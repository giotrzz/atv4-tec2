import Fastify from 'fastify';
import { conectarBanco, bancoSaudavel } from './db.js';
import { conectarRabbit, consumir, publicar } from './rabbit.js';
import { registrarHealth } from './health.js';

const FILA_REGISTRO = 'registro-projetos';
const FILA_EVENTOS = 'eventos-projetos';

async function iniciar() {
  const porta = Number(process.env.PORT ?? 3002);
  const pool = await conectarBanco(process.env.DATABASE_URL!);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY, genero TEXT NOT NULL, duracao INT NOT NULL, orcamento NUMERIC(14,2) NOT NULL,
      prazo TIMESTAMPTZ NOT NULL, papeis JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'ATIVO',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS recomendacoes (
      id SERIAL PRIMARY KEY, projeto_id TEXT NOT NULL REFERENCES projetos(id),
      equipe JSONB NOT NULL, criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
  const rabbit = await conectarRabbit(process.env.RABBITMQ_URL!);
  await rabbit.canal.assertQueue(FILA_EVENTOS, { durable: true });

  // A API publica a recomendação gerada; aqui o projeto é registrado (fonte de verdade)
  // e um evento é publicado para o serviço de notificações.
  await consumir(rabbit.canal, FILA_REGISTRO, async (msg) => {
    const p = msg.projeto;
    const existente = await pool.query('SELECT 1 FROM projetos WHERE id = $1', [p.id]);
    await pool.query(
      `INSERT INTO projetos (id, genero, duracao, orcamento, prazo, papeis)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET genero=$2, duracao=$3, orcamento=$4, prazo=$5, papeis=$6, atualizado_em=now()`,
      [p.id, p.genero, p.duracao, p.orcamento, p.prazo, JSON.stringify(p.papeisObrigatorios)],
    );
    await pool.query('INSERT INTO recomendacoes (projeto_id, equipe) VALUES ($1,$2)', [p.id, JSON.stringify(msg.equipe)]);

    await publicar(rabbit.canal, FILA_EVENTOS, {
      tipo: existente.rowCount ? 'PROJETO_ATUALIZADO' : 'PROJETO_CRIADO',
      projetoId: p.id,
      genero: p.genero,
      equipe: msg.equipe,
      ocorridoEm: new Date().toISOString(),
    });
    console.log(`[projetos] projeto ${p.id} registrado e evento publicado`);
  });
  console.log(`[projetos] consumindo a fila "${FILA_REGISTRO}"`);

  const app = Fastify();
  registrarHealth(app, { postgres: () => bancoSaudavel(pool), rabbitmq: () => rabbit.saudavel() });

  app.get('/projetos', async () => (await pool.query('SELECT * FROM projetos ORDER BY criado_em DESC')).rows);

  app.get<{ Params: { id: string } }>('/projetos/:id', async (req, reply) => {
    const projeto = await pool.query('SELECT * FROM projetos WHERE id = $1', [req.params.id]);
    if (!projeto.rowCount) return reply.status(404).send({ erro: 'Projeto não encontrado.' });
    const recs = await pool.query('SELECT equipe, criada_em FROM recomendacoes WHERE projeto_id = $1 ORDER BY id DESC', [req.params.id]);
    return { ...projeto.rows[0], recomendacoes: recs.rows };
  });

  app.post<{ Params: { id: string } }>('/projetos/:id/finalizar', async (req, reply) => {
    const r = await pool.query("UPDATE projetos SET status='FINALIZADO', atualizado_em=now() WHERE id=$1 RETURNING id", [req.params.id]);
    if (!r.rowCount) return reply.status(404).send({ erro: 'Projeto não encontrado.' });
    await publicar(rabbit.canal, FILA_EVENTOS, { tipo: 'PROJETO_FINALIZADO', projetoId: req.params.id, ocorridoEm: new Date().toISOString() });
    return { id: req.params.id, status: 'FINALIZADO' };
  });

  await app.listen({ port: porta, host: '0.0.0.0' });
  console.log(`cinebridge-projetos rodando na porta ${porta}`);
}

iniciar().catch((erro) => { console.error(erro); process.exit(1); });
