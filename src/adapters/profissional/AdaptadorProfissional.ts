import { Profissional } from '../../domain/entities/Profissional.js';

export interface CriteriosProfissional {
  competencia?: string;
  precoMax?: number;
}

export interface AdaptadorProfissional {
  listarProfissionais(criterios: any): Profissional[];
  detalharProfissional(id: string): Profissional;
  registrarAvaliacao(id: string, avaliacao: any): void;
}
