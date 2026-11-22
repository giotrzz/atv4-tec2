import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Observador } from '../observers/Observador.js';

export interface ValidadorProjeto { validar(projeto: Projeto, profissionais?: Profissional[]): boolean; }

export interface FabricaProjeto {
  criarProjeto(modelo: Projeto): Projeto;
  criarValidador(): ValidadorProjeto;
  criarRecomendador(): RecomendacaoStrategy;
  criarNotificador(): Observador;
}
