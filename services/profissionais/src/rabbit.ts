import amqp from 'amqplib';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ConexaoRabbit {
  canal: amqp.ConfirmChannel;
  saudavel(): boolean;
}

// Conecta com tentativas: o broker pode demorar a aceitar conexões mesmo após o container subir.
export async function conectarRabbit(url: string, tentativas = 30, intervaloMs = 2000): Promise<ConexaoRabbit> {
  let ultimoErro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const conexao = await amqp.connect(url);
      let aberta = true;
      conexao.on('close', () => { aberta = false; });
      conexao.on('error', () => { aberta = false; });
      // ConfirmChannel: o broker confirma cada mensagem publicada (confirmação de entrega).
      const canal = await conexao.createConfirmChannel();
      await canal.prefetch(10);
      return { canal, saudavel: () => aberta };
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

// Consumidor com confirmação manual (ack):
//  - mensagem ilegível (JSON inválido): descartada (ack), pois reenviar nunca resolveria;
//  - falha do handler (ex.: banco fora do ar): nack com requeue, para tentar de novo depois.
export async function consumir(
  canal: amqp.ConfirmChannel,
  fila: string,
  handler: (corpo: any, msg: amqp.ConsumeMessage) => Promise<void>,
): Promise<void> {
  await canal.assertQueue(fila, { durable: true });
  await canal.consume(fila, async (msg) => {
    if (!msg) return;
    let corpo: any;
    try {
      corpo = JSON.parse(msg.content.toString('utf-8'));
    } catch {
      console.error(`[rabbit] mensagem inválida descartada na fila ${fila}`);
      canal.ack(msg);
      return;
    }
    try {
      await handler(corpo, msg);
      canal.ack(msg);
    } catch (erro) {
      console.error(`[rabbit] erro processando mensagem da fila ${fila}:`, erro);
      setTimeout(() => canal.nack(msg, false, true), 2000);
    }
  });
}
