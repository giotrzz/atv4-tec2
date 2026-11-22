// Formato de dados da API externa SIMULADA (campos em snake_case, nomes diferentes do domínio).
export interface PerfilExterno {
  id: string;
  nome_completo: string;
  habilidades: { nome: string; nivel: number }[];
  tarifa: number;
  disponivel_de: string;
  disponivel_ate: string;
  notas: number[];
}

export interface FiltrosExternos {
  habilidade?: string;
  tarifaMax?: number;
}

// Sistema externo SIMULADO de cadastro de profissionais (rede social profissional / portal de empregos).
export class ApiProfissionalExterna {
  private readonly perfis: Map<string, PerfilExterno>;

  constructor(perfis: PerfilExterno[] = []) {
    this.perfis = new Map(perfis.map((p) => [p.id, structuredClone(p)]));
  }

  buscarProfissionais(filtros: FiltrosExternos = {}): PerfilExterno[] {
    return [...this.perfis.values()]
      .filter((p) => !filtros.habilidade || p.habilidades.some((h) => h.nome === filtros.habilidade))
      .filter((p) => filtros.tarifaMax === undefined || p.tarifa <= filtros.tarifaMax)
      .map((p) => structuredClone(p));
  }

  obterPerfil(id: string): PerfilExterno {
    const perfil = this.perfis.get(id);
    if (!perfil) throw new Error(`Profissional não encontrado: ${id}`);
    return structuredClone(perfil);
  }

  avaliarProfissional(id: string, nota: number): void {
    const perfil = this.perfis.get(id);
    if (!perfil) throw new Error(`Profissional não encontrado: ${id}`);
    perfil.notas.push(nota);
  }
}
