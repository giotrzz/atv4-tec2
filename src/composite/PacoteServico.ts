import { ServicoProjeto } from './ServicoProjeto.js';
import { Papel } from '../domain/enums/Papel.js';

// sequencial: prazo = soma dos prazos dos filhos; paralelo: prazo = maior prazo entre os filhos.
export type ModoExecucao = 'sequencial' | 'paralelo';

// Composite: contém outros ServicoProjeto (atômicos ou outros pacotes), em qualquer profundidade.
export class PacoteServico implements ServicoProjeto {
  private readonly filhos: ServicoProjeto[];

  constructor(
    public readonly nome: string,
    filhos: ServicoProjeto[] = [],
    public readonly modo: ModoExecucao = 'sequencial',
  ) {
    this.filhos = [];
    for (const filho of filhos) this.adicionar(filho);
  }

  adicionar(servico: ServicoProjeto): void {
    if (servico === this || contem(servico, this)) {
      throw new Error(`Ciclo detectado: "${servico.nome}" já contém o pacote "${this.nome}".`);
    }
    this.filhos.push(servico);
  }

  remover(servico: ServicoProjeto): boolean {
    const indice = this.filhos.indexOf(servico);
    if (indice < 0) return false;
    this.filhos.splice(indice, 1);
    return true;
  }

  calcularCusto(): number {
    return this.filhos.reduce((total, f) => total + f.calcularCusto(), 0);
  }

  listarSubservicos(): ServicoProjeto[] {
    return [...this.filhos];
  }

  obterPrazo(): number {
    const prazos = this.filhos.map((f) => f.obterPrazo());
    if (prazos.length === 0) return 0;
    return this.modo === 'paralelo' ? Math.max(...prazos) : prazos.reduce((a, b) => a + b, 0);
  }

  // Validação recursiva: pacote não vazio e todos os descendentes válidos
  // (serviços atômicos com papel válido, custo >= 0 e prazo > 0).
  validar(): boolean {
    return this.nome.trim().length > 0 && this.filhos.length > 0 && this.filhos.every((f) => f.validar());
  }

  obterPapeis(): Papel[] {
    const papeis = new Set<Papel>();
    for (const filho of this.filhos) for (const papel of filho.obterPapeis()) papeis.add(papel);
    return [...papeis];
  }

  clonar(): PacoteServico {
    return new PacoteServico(this.nome, this.filhos.map((f) => f.clonar()), this.modo);
  }
}

function contem(raiz: ServicoProjeto, alvo: ServicoProjeto): boolean {
  return raiz.listarSubservicos().some((f) => f === alvo || contem(f, alvo));
}
