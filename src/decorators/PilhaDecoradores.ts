import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { CacheDecorator } from './CacheDecorator.js';
import { AuditoriaDecorator, RegistroAuditoria } from './AuditoriaDecorator.js';
import { CompressaoDecorator } from './CompressaoDecorator.js';

export type PoliticaDecorador = 'cache' | 'auditoria' | 'compressao';

export interface ConfiguracaoDecoradores {
  /** Ordem de aplicação, do mais interno ao mais externo (ex.: cache -> auditoria -> compressao). */
  pilha: PoliticaDecorador[];
  ttlMs?: number;
  maximoCandidatosPorPapel?: number;
  aoRegistrarAuditoria?: (registro: RegistroAuditoria) => void;
}

const POLITICAS_VALIDAS: PoliticaDecorador[] = ['cache', 'auditoria', 'compressao'];

// Monta a pilha de decoradores em tempo de execução a partir de uma política de configuração.
// Mantém o estado compartilhado (cache e registros de auditoria) entre recomendações.
export class PilhaDecoradores {
  public readonly registrosAuditoria: RegistroAuditoria[] = [];
  private readonly armazenamentoCache = new Map<string, any>();

  constructor(private readonly configuracao: ConfiguracaoDecoradores) {}

  /** Ex.: "cache,auditoria,compressao" (útil para variável de ambiente). */
  static deTexto(texto: string, extras: Omit<ConfiguracaoDecoradores, 'pilha'> = {}): PilhaDecoradores {
    const itens = texto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    for (const item of itens) {
      if (!POLITICAS_VALIDAS.includes(item as PoliticaDecorador)) {
        throw new Error(`Decorador desconhecido: "${item}". Válidos: ${POLITICAS_VALIDAS.join(', ')}.`);
      }
    }
    return new PilhaDecoradores({ ...extras, pilha: itens as PoliticaDecorador[] });
  }

  aplicar(base: RecomendacaoStrategy): RecomendacaoStrategy {
    let atual = base;
    for (const politica of this.configuracao.pilha) {
      switch (politica) {
        case 'cache':
          atual = new CacheDecorator(atual, {
            ttlMs: this.configuracao.ttlMs,
            armazenamento: this.armazenamentoCache,
            escopo: base.constructor.name,
          });
          break;
        case 'auditoria':
          atual = new AuditoriaDecorator(atual, {
            registros: this.registrosAuditoria,
            aoRegistrar: this.configuracao.aoRegistrarAuditoria,
          });
          break;
        case 'compressao':
          atual = new CompressaoDecorator(atual, this.configuracao.maximoCandidatosPorPapel);
          break;
      }
    }
    return atual;
  }
}
