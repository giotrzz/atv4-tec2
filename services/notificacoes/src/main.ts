import Fastify from 'fastify';
import { conectarBanco, bancoSaudavel } from './db.js';
import { conectarRabbit, consumir } from './rabbit.js';
import { registrarHealth } from './health.js';
import { DespachanteEventos, NotificadorEmail, NotificadorInterno } from './observadores.js';

const FILA_EVENTOS = 'eventos-projetos';

async function iniciar() {
  const porta = Number(process.env.PORT ?? 3003);
  const pool = await conectarBanco(process.env.DATABASE_URL!);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id SERIAL PRIMARY KEY, tipo TEXT NOT NULL, canal TEXT NOT NULL, destinatario TEXT NOT NULL,
      mensagem TEXT NOT NULL, projeto_id TEXT, criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const rabbit = await conectarRabbit(process.env.RABBITMQ_URL!);

  const despachante = new DespachanteEventos();
  despachante.adicionar(new NotificadorEmail(pool));
  despachante.adicionar(new NotificadorInterno(pool));

  await consumir(rabbit.canal, FILA_EVENTOS, async (evento) => {
    await despachante.despachar(evento);
  });
  console.log(`[notificacoes] consumindo a fila "${FILA_EVENTOS}"`);

  const app = Fastify();
  registrarHealth(app, { postgres: () => bancoSaudavel(pool), rabbitmq: () => rabbit.saudavel() });
  app.get('/notificacoes', async () => (await pool.query('SELECT * FROM notificacoes ORDER BY id DESC LIMIT 100')).rows);

  await app.listen({ port: porta, host: '0.0.0.0' });
  console.log(`cinebridge-notificacoes rodando na porta ${porta}`);
}

iniciar().catch((erro) => { console.error(erro); process.exit(1); });
