import { RecomendadorDecorator, copiarResultado } from './RecomendadorDecorator.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Papel } from '../domain/enums/Papel.js';

interface EntradaCache {
  resultado: Map<Papel, Profissional[]>;
  expiraEm: number;
}

export interface OpcoesCache {
  ttlMs?: number;
  /** Permite compartilhar o cache entre instâncias (a pilha é remontada a cada recomendação). */
  armazenamento?: Map<string, EntradaCache>;
  /** Isola entradas de estratégias diferentes que compartilham o mesmo armazenamento. */
  escopo?: string;
  agora?: () => number;
}

export class CacheDecorator extends RecomendadorDecorator {
  public hits = 0;
  public misses = 0;
  private readonly armazenamento: Map<string, EntradaCache>;
  private readonly ttlMs: number;
  private readonly escopo: string;
  private readonly agora: () => number;

  constructor(interno: RecomendacaoStrategy, opcoes: OpcoesCache = {}) {
    super(interno);
    this.armazenamento = opcoes.armazenamento ?? new Map();
    this.ttlMs = opcoes.ttlMs ?? 60_000;
    this.escopo = opcoes.escopo ?? '';
    this.agora = opcoes.agora ?? (() => Date.now());
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<Papel, Profissional[]> {
    const chave = this.gerarChave(projeto, profissionais);
    const entrada = this.armazenamento.get(chave);

    if (entrada && entrada.expiraEm > this.agora()) {
      this.hits += 1;
      return copiarResultado(entrada.resultado);
    }

    this.misses += 1;
    const resultado = this.interno.recomendar(projeto, profissionais);
    this.armazenamento.set(chave, { resultado: copiarResultado(resultado), expiraEm: this.agora() + this.ttlMs });
    return resultado;
  }

  limpar(): void {
    this.armazenamento.clear();
  }

  private gerarChave(projeto: Projeto, profissionais: Profissional[]): string {
    return JSON.stringify({
      escopo: this.escopo,
      projeto: [projeto.id, projeto.genero, projeto.duracao, projeto.orcamento, projeto.papeisObrigatorios],
      profissionais: profissionais.map((p) => [
        p.id, p.precoMedio,
        p.competencias.map((c) => [c.nome, c.nivel]),
        p.avaliacoes.map((a) => a.nota),
      ]),
    });
  }
}
