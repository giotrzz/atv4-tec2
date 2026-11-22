import { RecomendadorDecorator } from './RecomendadorDecorator.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Papel } from '../domain/enums/Papel.js';

export interface RegistroAuditoria {
  projetoId: string;
  inicioEm: Date;
  duracaoMs: number;
  candidatosEntrada: number;
  papeisComResultado: number;
  sucesso: boolean;
  erro?: string;
}

export interface OpcoesAuditoria {
  /** Lista compartilhada onde os registros são acumulados. */
  registros?: RegistroAuditoria[];
  /** Destino adicional dos registros (ex.: console, arquivo, fila). */
  aoRegistrar?: (registro: RegistroAuditoria) => void;
}

export class AuditoriaDecorator extends RecomendadorDecorator {
  public readonly registros: RegistroAuditoria[];
  private readonly aoRegistrar?: (registro: RegistroAuditoria) => void;

  constructor(interno: RecomendacaoStrategy, opcoes: OpcoesAuditoria = {}) {
    super(interno);
    this.registros = opcoes.registros ?? [];
    this.aoRegistrar = opcoes.aoRegistrar;
  }

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<Papel, Profissional[]> {
    const inicioEm = new Date();
    const t0 = performance.now();
    try {
      const resultado = this.interno.recomendar(projeto, profissionais);
      this.registrar({
        projetoId: projeto.id, inicioEm, duracaoMs: performance.now() - t0,
        candidatosEntrada: profissionais.length, papeisComResultado: resultado.size, sucesso: true,
      });
      return resultado;
    } catch (erro) {
      this.registrar({
        projetoId: projeto.id, inicioEm, duracaoMs: performance.now() - t0,
        candidatosEntrada: profissionais.length, papeisComResultado: 0, sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      throw erro;
    }
  }

  private registrar(registro: RegistroAuditoria): void {
    this.registros.push(registro);
    this.aoRegistrar?.(registro);
  }
}
