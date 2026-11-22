import { Projeto } from './Projeto.js';
import { Papel } from '../enums/Papel.js';
import { ServicoProjeto } from '../../composite/ServicoProjeto.js';

export class ProjetoDocumentario extends Projeto {
  constructor(id: string, duracao: number, orcamento: number, prazo: Date,
    papeis: Papel[] = [Papel.DIRETOR, Papel.DIRETOR_FOTOGRAFIA, Papel.EDITOR],
    restricoes: Record<string, unknown> = { entrevistas: true },
    servicoPrincipal?: ServicoProjeto) {
    super(id, 'documentario', duracao, orcamento, prazo, papeis, restricoes, servicoPrincipal);
  }
  override clonar(): ProjetoDocumentario {
    return new ProjetoDocumentario(this.id, this.duracao, this.orcamento, new Date(this.prazo),
      [...this.papeisObrigatorios], structuredClone(this.restricoes), this.servicoPrincipal?.clonar());
  }
}
export class ProjetoAnimacao extends Projeto {
  constructor(id: string, duracao: number, orcamento: number, prazo: Date,
    papeis: Papel[] = [Papel.DIRETOR, Papel.EFEITOS_VISUAIS, Papel.SONOPLASTA],
    restricoes: Record<string, unknown> = { renderizacao3D: true },
    servicoPrincipal?: ServicoProjeto) {
    super(id, 'animacao', duracao, orcamento, prazo, papeis, restricoes, servicoPrincipal);
  }
  override clonar(): ProjetoAnimacao {
    return new ProjetoAnimacao(this.id, this.duracao, this.orcamento, new Date(this.prazo),
      [...this.papeisObrigatorios], structuredClone(this.restricoes), this.servicoPrincipal?.clonar());
  }
}
export class ProjetoPublicitario extends Projeto {
  constructor(id: string, duracao: number, orcamento: number, prazo: Date,
    papeis: Papel[] = [Papel.DIRETOR, Papel.DIRETOR_FOTOGRAFIA, Papel.EDITOR],
    restricoes: Record<string, unknown> = { entregaRapida: true },
    servicoPrincipal?: ServicoProjeto) {
    super(id, 'publicitario', duracao, orcamento, prazo, papeis, restricoes, servicoPrincipal);
  }
  override clonar(): ProjetoPublicitario {
    return new ProjetoPublicitario(this.id, this.duracao, this.orcamento, new Date(this.prazo),
      [...this.papeisObrigatorios], structuredClone(this.restricoes), this.servicoPrincipal?.clonar());
  }
}
