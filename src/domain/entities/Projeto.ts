import { Papel } from '../enums/Papel.js';
import { Profissional } from './Profissional.js';
import { VisitanteProjeto } from '../../visitors/VisitanteProjeto.js';
import { ServicoProjeto } from '../../composite/ServicoProjeto.js';

export class Projeto {
  public readonly papeisObrigatorios: Papel[];

  constructor(
    public readonly id: string,
    public readonly genero: string,
    public readonly duracao: number,
    public readonly orcamento: number,
    public readonly prazo: Date,
    papeisObrigatorios: Papel[],
    public readonly restricoes: Record<string, unknown> = {},
    // Composite (ATV3): raiz da hierarquia de serviços do projeto. Opcional para manter
    // compatibilidade com os projetos criados nas atividades anteriores (lista simples de papéis).
    public readonly servicoPrincipal?: ServicoProjeto,
  ) {
    // Quando há hierarquia de serviços e nenhuma lista explícita, os papéis são derivados dela.
    this.papeisObrigatorios =
      papeisObrigatorios.length === 0 && servicoPrincipal ? servicoPrincipal.obterPapeis() : papeisObrigatorios;
  }

  clonar(): Projeto {
    return new Projeto(this.id, this.genero, this.duracao, this.orcamento,
      new Date(this.prazo.getTime()), [...this.papeisObrigatorios],
      structuredClone(this.restricoes), this.servicoPrincipal?.clonar());
  }

  // O custo é delegado ao serviço principal, que propaga recursivamente pela hierarquia.
  calcularCustoTotal(): number {
    return this.servicoPrincipal?.calcularCusto() ?? 0;
  }

  obterPrazoTotalDias(): number {
    return this.servicoPrincipal?.obterPrazo() ?? 0;
  }

  // Validação recursiva da estrutura. Projetos sem hierarquia (modelo antigo) são considerados válidos.
  validarEstrutura(): boolean {
    return this.servicoPrincipal ? this.servicoPrincipal.validar() : true;
  }

  aceitarRecomendacao(_papel: Papel, _profissional: Profissional): void {
    throw new Error('A recomendação é responsabilidade do OrquestradorEquipe.');
  }
  substituirMembro(_papel: Papel, _profissional: Profissional): void {
    throw new Error('A substituição é responsabilidade da estratégia de recomendação.');
  }
  solicitarReavaliacao(): void {
    throw new Error('A reavaliação é responsabilidade do SistemaRecomendacao.');
  }
  aceita(visitante: VisitanteProjeto): unknown { return visitante.visitarProjeto(this); }
}
