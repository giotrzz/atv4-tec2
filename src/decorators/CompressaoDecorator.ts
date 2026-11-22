import { gzipSync } from 'node:zlib';
import { RecomendadorDecorator } from './RecomendadorDecorator.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Papel } from '../domain/enums/Papel.js';

export interface RelatorioCompressao {
  bytesAntes: number;
  bytesDepois: number;
  bytesGzip: number;
}

export function serializarResultado(resultado: Map<Papel, Profissional[]>): string {
  return JSON.stringify(Object.fromEntries(resultado));
}

// INTERPRETAÇÃO: a interface RecomendacaoStrategy devolve um Map (não bytes). Por isso "compressão"
// aqui significa reduzir o volume transmitido: mantém só os N melhores candidatos por papel
// (a montagem da Equipe usa apenas o primeiro de cada lista). Para o tráfego de rede, o resultado
// reduzido ainda pode ser comprimido em gzip via comprimirParaTransmissao().
export class CompressaoDecorator extends RecomendadorDecorator {
  public ultimoRelatorio?: RelatorioCompressao;

  constructor(interno: RecomendacaoStrategy, private readonly maximoCandidatosPorPapel = 3) {
    super(interno);
    if (maximoCandidatosPorPapel < 1) throw new Error('maximoCandidatosPorPapel deve ser >= 1.');
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<Papel, Profissional[]> {
    const completo = this.interno.recomendar(projeto, profissionais);
    const reduzido = new Map<Papel, Profissional[]>();
    for (const [papel, candidatos] of completo) {
      reduzido.set(papel, candidatos.slice(0, this.maximoCandidatosPorPapel));
    }
    this.ultimoRelatorio = {
      bytesAntes: Buffer.byteLength(serializarResultado(completo)),
      bytesDepois: Buffer.byteLength(serializarResultado(reduzido)),
      bytesGzip: this.comprimirParaTransmissao(reduzido).length,
    };
    return reduzido;
  }

  comprimirParaTransmissao(resultado: Map<Papel, Profissional[]>): Buffer {
    return gzipSync(Buffer.from(serializarResultado(resultado)));
  }
}
