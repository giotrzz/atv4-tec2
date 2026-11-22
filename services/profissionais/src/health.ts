import { FastifyInstance } from 'fastify';

// GET /health: 200 só se banco e RabbitMQ estão acessíveis; 503 caso contrário.
export function registrarHealth(
  app: FastifyInstance,
  verificacoes: Record<string, () => Promise<boolean> | boolean>,
): void {
  app.get('/health', async (_req, reply) => {
    const resultado: Record<string, string> = {};
    let tudoOk = true;
    for (const [nome, verificar] of Object.entries(verificacoes)) {
      const ok = await verificar();
      resultado[nome] = ok ? 'ok' : 'falha';
      tudoOk = tudoOk && ok;
    }
    return reply.status(tudoOk ? 200 : 503).send({ status: tudoOk ? 'ok' : 'indisponivel', ...resultado });
  });
}
