import { Pool } from 'pg';

export interface ProfissionalDTO {
  id: string;
  nome: string;
  competencias: { nome: string; nivel: number }[];
  disponibilidade: { inicio: string; fim: string };
  precoMedio: number;
  avaliacoes: { nota: number; comentario: string; data: string }[];
}

export async function criarSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profissionais (
      id            TEXT PRIMARY KEY,
      nome          TEXT NOT NULL,
      competencias  JSONB NOT NULL DEFAULT '[]',
      disp_inicio   TIMESTAMPTZ NOT NULL,
      disp_fim      TIMESTAMPTZ NOT NULL,
      preco_medio   NUMERIC(12,2) NOT NULL,
      avaliacoes    JSONB NOT NULL DEFAULT '[]'
    )`);
}

const SEED: ProfissionalDTO[] = [
  { id: 'prof-001', nome: 'Ana Souza', precoMedio: 4500,
    competencias: [{ nome: 'Direção', nivel: 9 }, { nome: 'Liderança', nivel: 8 }],
    disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2027-12-31T00:00:00.000Z' },
    avaliacoes: [{ nota: 5, comentario: 'Excelente', data: '2026-03-10T00:00:00.000Z' }] },
  { id: 'prof-002', nome: 'Bruno Lima', precoMedio: 3800,
    competencias: [{ nome: 'Fotografia', nivel: 9 }, { nome: 'Iluminação', nivel: 7 }],
    disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2027-12-31T00:00:00.000Z' },
    avaliacoes: [{ nota: 4, comentario: 'Muito bom', data: '2026-04-02T00:00:00.000Z' }] },
  { id: 'prof-003', nome: 'Carla Mendes', precoMedio: 3200,
    competencias: [{ nome: 'Edição', nivel: 8 }, { nome: 'Montagem', nivel: 8 }],
    disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2027-12-31T00:00:00.000Z' },
    avaliacoes: [{ nota: 5, comentario: 'Ágil e criativa', data: '2026-05-21T00:00:00.000Z' }] },
  { id: 'prof-004', nome: 'Diego Rocha', precoMedio: 2900,
    competencias: [{ nome: 'Som', nivel: 8 }, { nome: 'Mixagem', nivel: 9 }],
    disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2027-12-31T00:00:00.000Z' },
    avaliacoes: [] },
  { id: 'prof-005', nome: 'Elisa Prado', precoMedio: 5200,
    competencias: [{ nome: 'VFX', nivel: 9 }, { nome: 'Animação', nivel: 9 }],
    disponibilidade: { inicio: '2026-01-01T00:00:00.000Z', fim: '2027-12-31T00:00:00.000Z' },
    avaliacoes: [{ nota: 5, comentario: 'Referência em VFX', data: '2026-06-15T00:00:00.000Z' }] },
];

// Popula dados de demonstração apenas se a tabela estiver vazia.
export async function semear(pool: Pool): Promise<void> {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM profissionais');
  if (rows[0].total > 0) return;
  for (const p of SEED) await inserir(pool, p);
  console.log(`[profissionais] ${SEED.length} profissionais de exemplo inseridos`);
}

export async function inserir(pool: Pool, p: ProfissionalDTO): Promise<void> {
  await pool.query(
    `INSERT INTO profissionais (id, nome, competencias, disp_inicio, disp_fim, preco_medio, avaliacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET nome=$2, competencias=$3, disp_inicio=$4, disp_fim=$5, preco_medio=$6, avaliacoes=$7`,
    [p.id, p.nome, JSON.stringify(p.competencias), p.disponibilidade.inicio, p.disponibilidade.fim, p.precoMedio, JSON.stringify(p.avaliacoes ?? [])],
  );
}

export interface Criterios { competencia?: string; precoMax?: number }

export async function listar(pool: Pool, criterios: Criterios = {}): Promise<ProfissionalDTO[]> {
  const { rows } = await pool.query('SELECT * FROM profissionais ORDER BY id');
  return rows
    .map((r): ProfissionalDTO => ({
      id: r.id,
      nome: r.nome,
      competencias: r.competencias,
      disponibilidade: { inicio: new Date(r.disp_inicio).toISOString(), fim: new Date(r.disp_fim).toISOString() },
      precoMedio: Number(r.preco_medio), // NUMERIC chega como string
      avaliacoes: r.avaliacoes,
    }))
    .filter((p) => !criterios.competencia || p.competencias.some((c) => c.nome === criterios.competencia))
    .filter((p) => criterios.precoMax === undefined || p.precoMedio <= criterios.precoMax);
}
