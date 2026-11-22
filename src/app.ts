import Fastify from 'fastify';
import { OrquestradorPadrao } from './orchestration/OrquestradorPadrao.js';
import { RegrasOrcamento } from './strategies/RegrasOrcamento.js';
import { SistemaRecomendacao } from './observers/SistemaRecomendacao.js';
import { NotificadorEmail } from './observers/NotificadorEmail.js';
import { NotificadorInterno } from './observers/NotificadorInterno.js';
import { AuditoriaRecomendacao } from './observers/AuditoriaRecomendacao.js';
import { PilhaDecoradores } from './decorators/PilhaDecoradores.js';
import { RecomendadorBase } from './decorators/RecomendadorBase.js';
import { registrarRotas, Mensageria } from './http/rotas.js';

export interface OpcoesApp {
  /** Ponte com o RabbitMQ (ATV4). Sem ela, a API funciona como nas atividades anteriores. */
  mensageria?: Mensageria;
  /** Política de decoradores, ex.: "cache,auditoria,compressao". Vazio = sem decoradores. */
  decoradores?: string;
}

export function criarSistema(opcoes: OpcoesApp = {}): SistemaRecomendacao {
  const orquestrador = new OrquestradorPadrao();
  const estrategiaInicial = new RegrasOrcamento();
  const sistema = new SistemaRecomendacao(orquestrador, estrategiaInicial);

  sistema.adicionarObservador(new NotificadorEmail());
  sistema.adicionarObservador(new NotificadorInterno());
  sistema.adicionarObservador(new AuditoriaRecomendacao());

  if (opcoes.decoradores?.trim()) {
    const pilha = PilhaDecoradores.deTexto(opcoes.decoradores);
    sistema.definirDecoradores((estrategia) => pilha.aplicar(new RecomendadorBase(estrategia)));
  }
  return sistema;
}

export function criarApp(opcoes: OpcoesApp = {}) {
  const app = Fastify();
  const sistemaRecomendacao = criarSistema(opcoes);
  registrarRotas(app, sistemaRecomendacao, opcoes.mensageria);
  return app;
}
