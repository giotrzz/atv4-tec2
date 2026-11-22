import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';

// Filas (todas duráveis). Os nomes são o contrato entre os microsserviços.
export const FILA_CONSULTA_PROFISSIONAIS = 'consulta-profissionais';
export const FILA_REGISTRO_PROJETOS = 'registro-projetos';
export const FILA_EVENTOS_PROJETOS = 'eventos-projetos';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ConexaoRabbit {
  canal: amqp.ConfirmChannel;
  saudavel(): boolean;
  fechar(): Promise<void>;
}

// Conecta com tentativas: no docker-compose o broker pode demorar a aceitar conexões.
export async function conectarRabbit(url: string, tentativas = 30, intervaloMs = 2000): Promise<ConexaoRabbit> {
  let ultimoErro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const conexao = await amqp.connect(url);
      let aberta = true;
      conexao.on('close', () => { aberta = false; });
      conexao.on('error', () => { aberta = false; });
      // ConfirmChannel: o broker confirma o recebimento de cada mensagem publicada.
      const canal = await conexao.createConfirmChannel();
      return {
        canal,
        saudavel: () => aberta,
        fechar: async () => { aberta = false; await conexao.close(); },
      };
    } catch (erro) {
      ultimoErro = erro;
      console.log(`[rabbit] tentativa ${i}/${tentativas} falhou; nova tentativa em ${intervaloMs}ms`);
      await esperar(intervaloMs);
    }
  }
  throw ultimoErro;
}

export async function publicar(canal: amqp.ConfirmChannel, fila: string, mensagem: unknown, opcoes: amqp.Options.Publish = {}): Promise<void> {
  await canal.assertQueue(fila, { durable: true });
  await new Promise<void>((resolve, reject) => {
    canal.sendToQueue(fila, Buffer.from(JSON.stringify(mensagem)), { persistent: true, contentType: 'application/json', ...opcoes }, (erro) =>
      erro ? reject(erro) : resolve(),
    );
  });
}

// Padrão RPC sobre filas: publica em `fila` com uma fila de retorno única (nomeada com UUID).
export async function chamarRpc<T>(canal: amqp.ConfirmChannel, fila: string, requisicao: unknown, timeoutMs = 5000): Promise<T> {
  const correlationId = randomUUID();
  const filaRetorno = `retorno-${correlationId}`;
  await canal.assertQueue(fila, { durable: true });
  await canal.assertQueue(filaRetorno, { exclusive: true, autoDelete: true, durable: false });

  return new Promise<T>((resolve, reject) => {
    let consumerTag = '';
    const limpar = async () => {
      clearTimeout(temporizador);
      try { if (consumerTag) await canal.cancel(consumerTag); await canal.deleteQueue(filaRetorno); } catch { /* canal já fechado */ }
    };
    const temporizador = setTimeout(() => {
      void limpar();
      reject(new Error(`Timeout aguardando resposta da fila "${fila}".`));
    }, timeoutMs);

    canal.consume(filaRetorno, (msg) => {
      if (!msg || msg.properties.correlationId !== correlationId) return;
      canal.ack(msg);
      void limpar();
      const corpo = JSON.parse(msg.content.toString('utf-8'));
      if (corpo?.erro) reject(new Error(String(corpo.erro)));
      else resolve(corpo as T);
    }).then((r) => { consumerTag = r.consumerTag; }, reject);

    canal.sendToQueue(fila, Buffer.from(JSON.stringify(requisicao)), {
      persistent: true, contentType: 'application/json', correlationId, replyTo: filaRetorno,
    }, (erro) => { if (erro) { void limpar(); reject(erro); } });
  });
}
