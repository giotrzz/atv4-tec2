import { ServicoProjeto } from './ServicoProjeto.js';
import { Papel } from '../domain/enums/Papel.js';

// Folha do Composite: um serviço individual (ex.: edição de vídeo, mixagem de áudio).
export class ServicoAtomico implements ServicoProjeto {
  constructor(
    public readonly nome: string,
    private readonly custo: number,
    private readonly prazoDias: number,
    public readonly papel: Papel,
  ) {}

  calcularCusto(): number {
    return this.custo;
  }

  listarSubservicos(): ServicoProjeto[] {
    return [];
  }

  obterPrazo(): number {
    return this.prazoDias;
  }

  validar(): boolean {
    return (
      this.nome.trim().length > 0 &&
      Number.isFinite(this.custo) && this.custo >= 0 &&
      Number.isFinite(this.prazoDias) && this.prazoDias > 0 &&
      Object.values(Papel).includes(this.papel)
    );
  }

  obterPapeis(): Papel[] {
    return [this.papel];
  }

  clonar(): ServicoAtomico {
    return new ServicoAtomico(this.nome, this.custo, this.prazoDias, this.papel);
  }
}
