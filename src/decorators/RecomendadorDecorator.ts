import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { Profissional } from '../domain/entities/Profissional.js';
import { Papel } from '../domain/enums/Papel.js';

// Decorator abstrato: mesma interface do componente, envolvendo outra RecomendacaoStrategy.
export abstract class RecomendadorDecorator implements RecomendacaoStrategy {
  constructor(protected readonly interno: RecomendacaoStrategy) {}

  abstract recomendar(projeto: Projeto, profissionais: Profissional[]): Map<Papel, Profissional[]>;
}

export function copiarResultado(resultado: Map<Papel, Profissional[]>): Map<Papel, Profissional[]> {
  return new Map([...resultado].map(([papel, lista]) => [papel, [...lista]] as [Papel, Profissional[]]));
}
