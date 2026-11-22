import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { SimilaridadeCosseno } from '../strategies/SimilaridadeCosseno.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Papel } from '../domain/enums/Papel.js';

// Componente concreto do Decorator: contém a lógica principal de recomendação (reaproveita
// as estratégias já existentes; por padrão, similaridade de cosseno).
export class RecomendadorBase implements RecomendacaoStrategy {
  constructor(private readonly nucleo: RecomendacaoStrategy = new SimilaridadeCosseno()) {}

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<Papel, Profissional[]> {
    return this.nucleo.recomendar(projeto, profissionais);
  }
}
