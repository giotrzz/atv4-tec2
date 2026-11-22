import { criarApp } from './app.js';
import { conectarRabbit } from './mensageria/rabbit.js';
import { MensageriaRabbit } from './mensageria/MensageriaRabbit.js';

async function iniciar() {
  const porta = Number(process.env.PORT ?? 3000);
  const rabbitUrl = process.env.RABBITMQ_URL;

  const mensageria = rabbitUrl ? new MensageriaRabbit(await conectarRabbit(rabbitUrl)) : undefined;
  const app = criarApp({ mensageria, decoradores: process.env.DECORADORES });

  try {
    await app.listen({ port: porta, host: '0.0.0.0' });
    console.log(`cinebridge-api rodando na porta ${porta}`);
  } catch (erro) {
    console.error(erro);
    process.exit(1);
  }
}

void iniciar();
