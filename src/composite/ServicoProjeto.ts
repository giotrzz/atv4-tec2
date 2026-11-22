import { Papel } from '../domain/enums/Papel.js';

// Componente do padrão Composite: serviços atômicos e pacotes são tratados de forma uniforme.
export interface ServicoProjeto {
  readonly nome: string;
  calcularCusto(): number;
  listarSubservicos(): ServicoProjeto[];
  /** Prazo em dias. */
  obterPrazo(): number;
  validar(): boolean;
  // Extensões úteis ao restante do sistema (derivar papéis e copiar a estrutura).
  obterPapeis(): Papel[];
  clonar(): ServicoProjeto;
}
