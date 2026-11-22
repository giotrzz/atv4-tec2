import { Pool } from 'pg';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function conectarBanco(url: string, tentativas = 30, intervaloMs = 2000): Promise<Pool> {
  const pool = new Pool({ connectionString: url });
  let ultimoErro: unknown;
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      return pool;
    } catch (erro) {
      ultimoErro = erro;
      console.log(`[db] tentativa ${i}/${tentativas} falhou; nova tentativa em ${intervaloMs}ms`);
      await esperar(intervaloMs);
    }
  }
  throw ultimoErro;
}

export async function bancoSaudavel(pool: Pool): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}
