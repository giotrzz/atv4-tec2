import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Equipe } from '../domain/entities/Equipe.js';
import { OrquestradorEquipe } from '../orchestration/OrquestradorEquipe.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Observador } from './Observador.js';
import { EventoRecomendacao } from './EventoRecomendacao.js';
import { selecionarFabrica } from '../factories/FabricasConcretas.js';
import { AdaptadorArmazenamento } from '../adapters/armazenamento/AdaptadorArmazenamento.js';
import { AdaptadorPagamento } from '../adapters/pagamento/AdaptadorPagamento.js';
import { AdaptadorProfissional } from '../adapters/profissional/AdaptadorProfissional.js';
import { GeradorRelatorio } from '../visitors/GeradorRelatorio.js';

export type DecoradorDeEstrategia = (estrategia: RecomendacaoStrategy) => RecomendacaoStrategy;

export class SistemaRecomendacao {
  private observadores: Observador[] = [];
  private notificadoresPorTipo = new Map<string, Observador>();
  private estrategiaAtual: RecomendacaoStrategy;

  // Adapter (ATV3): o núcleo só conhece as interfaces, nunca os provedores concretos.
  private adaptadorArmazenamento?: AdaptadorArmazenamento;
  private adaptadorPagamento?: AdaptadorPagamento;
  private adaptadorProfissional?: AdaptadorProfissional;

  // Decorator (ATV3): função que envolve a estratégia escolhida com a pilha configurada em runtime.
  private decoradorDeEstrategia?: DecoradorDeEstrategia;

  constructor(
    private readonly orquestrador: OrquestradorEquipe,
    estrategiaInicial: RecomendacaoStrategy,
    adaptadores?: {
      armazenamento?: AdaptadorArmazenamento;
      pagamento?: AdaptadorPagamento;
      profissional?: AdaptadorProfissional;
    },
  ) {
    this.estrategiaAtual = estrategiaInicial;
    this.adaptadorArmazenamento = adaptadores?.armazenamento;
    this.adaptadorPagamento = adaptadores?.pagamento;
    this.adaptadorProfissional = adaptadores?.profissional;
  }

  definirEstrategia(estrategia: RecomendacaoStrategy): void {
    this.estrategiaAtual = estrategia;
  }

  configurarAdaptadores(
    armazenamento: AdaptadorArmazenamento,
    pagamento: AdaptadorPagamento,
    profissional: AdaptadorProfissional,
  ): void {
    this.adaptadorArmazenamento = armazenamento;
    this.adaptadorPagamento = pagamento;
    this.adaptadorProfissional = profissional;
  }

  /** Define (ou remove, com undefined) a pilha de decoradores aplicada a toda recomendação. */
  definirDecoradores(decorador: DecoradorDeEstrategia | undefined): void {
    this.decoradorDeEstrategia = decorador;
  }

  // INTERPRETAÇÃO: mesma lacuna já resolvida em OrquestradorEquipe.orquestrar() — o diagrama
  // não mostra de onde vem a lista de profissionais, então ela entra como parâmetro extra.
  // Na ATV3 ela passa a ser opcional: sem a lista, os candidatos vêm do AdaptadorProfissional.
  executarRecomendacao(projeto: Projeto, profissionais?: Profissional[]): Equipe {
    const candidatos = profissionais ?? this.listarCandidatosDoAdaptador();

    const fabrica = selecionarFabrica(projeto.genero);
    this.orquestrador.definirFabrica(fabrica);
    const tipoEspecializado = ['documentario', 'documentário', 'animacao', 'animação', 'publicitario', 'publicitário']
      .includes(projeto.genero.trim().toLowerCase());
    const estrategiaBase = tipoEspecializado ? fabrica.criarRecomendador() : this.estrategiaAtual;
    const estrategia = this.decoradorDeEstrategia ? this.decoradorDeEstrategia(estrategiaBase) : estrategiaBase;
    const projetoConfigurado = tipoEspecializado ? fabrica.criarProjeto(projeto) : projeto;
    if (tipoEspecializado && !this.notificadoresPorTipo.has(fabrica.constructor.name)) {
      const notificador = fabrica.criarNotificador();
      this.notificadoresPorTipo.set(fabrica.constructor.name, notificador);
      this.adicionarObservador(notificador);
    }
    const equipe = this.orquestrador.orquestrar(projetoConfigurado, estrategia, candidatos);

    const dados = new Map<string, unknown>([
      ['projetoId', projeto.id],
      ['equipeId', equipe.id],
    ]);

    // Se houver armazenamento configurado, arquiva o relatório do projeto (qualquer provedor serve).
    if (this.adaptadorArmazenamento) {
      const relatorio = projeto.aceita(new GeradorRelatorio()) as string;
      const arquivoId = this.adaptadorArmazenamento.salvarArquivo(Buffer.from(relatorio, 'utf-8'), {
        nome: `relatorios/${projeto.id}.txt`,
        tipo: 'text/plain',
      });
      dados.set('relatorioArquivoId', arquivoId);
    }

    this.notificarObservadores(new EventoRecomendacao('RECOMENDACAO_GERADA', dados, 'SistemaRecomendacao'));

    return equipe;
  }

  // Paga cada membro da equipe pelo gateway configurado (Stripe, PagSeguro, PayPal...).
  efetuarPagamentoEquipe(equipe: Equipe, pagador = 'cinebridge'): string[] {
    if (!this.adaptadorPagamento) throw new Error('Nenhum adaptador de pagamento configurado.');
    return equipe.membros.map((m) =>
      this.adaptadorPagamento!.efetuarPagamento(m.profissional.precoMedio, pagador, m.profissional.id),
    );
  }

  private listarCandidatosDoAdaptador(): Profissional[] {
    if (!this.adaptadorProfissional) {
      throw new Error('Lista de profissionais não informada e nenhum adaptador de profissionais configurado.');
    }
    return this.adaptadorProfissional.listarProfissionais({});
  }

  adicionarObservador(observador: Observador): void {
    this.observadores.push(observador);
  }

  notificarObservadores(evento: EventoRecomendacao): void {
    for (const observador of this.observadores) {
      try {
        observador.atualizar(evento);
      } catch {
        // Um observador falhar não deve impedir os demais de serem notificados,
        // conforme requisito de tolerância a falhas do enunciado.
      }
    }
  }
}
