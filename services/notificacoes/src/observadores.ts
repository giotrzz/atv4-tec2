import { Pool } from 'pg';

export interface EventoProjeto {
  tipo: string;
  projetoId: string;
  equipe?: { equipeId: string; membros: { papel: string; profissionalId: string }[] };
  ocorridoEm: string;
  [campo: string]: unknown;
}

// Padrão Observer: o despachante notifica todos os observadores registrados para cada evento recebido.
export interface ObservadorEvento {
  atualizar(evento: EventoProjeto): Promise<void>;
}

export class DespachanteEventos {
  private readonly observadores: ObservadorEvento[] = [];

  adicionar(observador: ObservadorEvento): void {
    this.observadores.push(observador);
  }

  async despachar(evento: EventoProjeto): Promise<void> {
    // Um observador que falha não impede os demais; o erro é registrado.
    await Promise.all(this.observadores.map(async (o) => {
      try { await o.atualizar(evento); } catch (erro) { console.error('[notificacoes] observador falhou:', erro); }
    }));
  }
}

export function montarMensagem(evento: EventoProjeto): string {
  switch (evento.tipo) {
    case 'PROJETO_CRIADO':
      return `Projeto ${evento.projetoId} criado. Equipe recomendada: ${evento.equipe?.membros.map((m) => `${m.papel}=${m.profissionalId}`).join(', ') || 'sem candidatos'}.`;
    case 'PROJETO_ATUALIZADO':
      return `Projeto ${evento.projetoId} atualizado. Nova recomendação de equipe gerada.`;
    case 'PROJETO_FINALIZADO':
      return `Projeto ${evento.projetoId} finalizado.`;
    default:
      return `Evento ${evento.tipo} no projeto ${evento.projetoId}.`;
  }
}

// Simula o envio de e-mail (apenas log) e grava o histórico no banco.
export class NotificadorEmail implements ObservadorEvento {
  constructor(private readonly pool: Pool) {}
  async atualizar(evento: EventoProjeto): Promise<void> {
    const mensagem = montarMensagem(evento);
    console.log(`[EMAIL] para produtor@cinebridge.local: ${mensagem}`);
    await this.pool.query(
      'INSERT INTO notificacoes (tipo, canal, destinatario, mensagem, projeto_id) VALUES ($1,$2,$3,$4,$5)',
      [evento.tipo, 'email', 'produtor@cinebridge.local', mensagem, evento.projetoId],
    );
  }
}

export class NotificadorInterno implements ObservadorEvento {
  constructor(private readonly pool: Pool) {}
  async atualizar(evento: EventoProjeto): Promise<void> {
    const mensagem = montarMensagem(evento);
    console.log(`[INTERNA] painel: ${mensagem}`);
    await this.pool.query(
      'INSERT INTO notificacoes (tipo, canal, destinatario, mensagem, projeto_id) VALUES ($1,$2,$3,$4,$5)',
      [evento.tipo, 'interna', 'painel-produtor', mensagem, evento.projetoId],
    );
  }
}
