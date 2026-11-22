import { AdaptadorProfissional, CriteriosProfissional } from './AdaptadorProfissional.js';
import { ApiProfissionalExterna, PerfilExterno } from './ApiProfissionalExterna.js';
import { Profissional } from '../../domain/entities/Profissional.js';
import { Competencia } from '../../domain/entities/Competencia.js';
import { Avaliacao } from '../../domain/entities/Avaliacao.js';

function validarNota(avaliacao: any): number {
  const nota = Number(avaliacao?.nota);
  if (!Number.isFinite(nota) || nota < 0 || nota > 5) throw new Error('A nota da avaliação deve estar entre 0 e 5.');
  return nota;
}

// Traduz o formato externo (snake_case) para a entidade Profissional do domínio.
function perfilParaProfissional(perfil: PerfilExterno, fatorNivel: number): Profissional {
  const profissional = new Profissional(
    perfil.id,
    perfil.nome_completo,
    perfil.habilidades.map((h) => new Competencia(h.nome, h.nivel * fatorNivel)),
    { inicio: new Date(perfil.disponivel_de), fim: new Date(perfil.disponivel_ate) },
    perfil.tarifa,
  );
  for (const nota of perfil.notas) profissional.avaliacoes.push(new Avaliacao(nota, '', new Date()));
  return profissional;
}

abstract class AdaptadorProfissionalExternoBase implements AdaptadorProfissional {
  protected constructor(
    protected readonly api: ApiProfissionalExterna,
    private readonly fatorNivel: number,
  ) {}

  listarProfissionais(criterios: CriteriosProfissional = {}): Profissional[] {
    return this.api
      .buscarProfissionais({ habilidade: criterios.competencia, tarifaMax: criterios.precoMax })
      .map((p) => perfilParaProfissional(p, this.fatorNivel));
  }

  detalharProfissional(id: string): Profissional {
    return perfilParaProfissional(this.api.obterPerfil(id), this.fatorNivel);
  }

  registrarAvaliacao(id: string, avaliacao: any): void {
    this.api.avaliarProfissional(id, validarNota(avaliacao));
  }
}

// LinkedIn (simulado) expressa proficiência de 1 a 5; o domínio usa a escala de 0 a 10.
export class AdaptadorLinkedIn extends AdaptadorProfissionalExternoBase {
  constructor(api: ApiProfissionalExterna = new ApiProfissionalExterna()) {
    super(api, 2);
  }
}

// Indeed (simulado) já usa a escala de 0 a 10 do domínio.
export class AdaptadorIndeed extends AdaptadorProfissionalExternoBase {
  constructor(api: ApiProfissionalExterna = new ApiProfissionalExterna()) {
    super(api, 1);
  }
}

// Cadastro interno: não há sistema externo, os próprios objetos do domínio são o repositório.
export class AdaptadorInterno implements AdaptadorProfissional {
  private readonly profissionais = new Map<string, Profissional>();

  constructor(profissionais: Profissional[] = []) {
    for (const p of profissionais) this.profissionais.set(p.id, p);
  }

  listarProfissionais(criterios: CriteriosProfissional = {}): Profissional[] {
    return [...this.profissionais.values()]
      .filter((p) => !criterios.competencia || p.competencias.some((c) => c.nome === criterios.competencia))
      .filter((p) => criterios.precoMax === undefined || p.precoMedio <= criterios.precoMax);
  }

  detalharProfissional(id: string): Profissional {
    const profissional = this.profissionais.get(id);
    if (!profissional) throw new Error(`Profissional não encontrado: ${id}`);
    return profissional;
  }

  registrarAvaliacao(id: string, avaliacao: any): void {
    const nota = validarNota(avaliacao);
    this.detalharProfissional(id).avaliacoes.push(new Avaliacao(nota, String(avaliacao?.comentario ?? ''), new Date()));
  }
}
