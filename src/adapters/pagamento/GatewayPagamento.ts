export interface Transacao {
  id: string;
  valor: number;
  moeda: string;
  status: 'succeeded' | 'refunded';
  dados: Record<string, unknown>;
}

// Gateway de pagamento externo SIMULADO. Recebe o valor na unidade que o chamador enviar
// (centavos, reais...) e usa status em inglês, como muitos provedores reais.
export class GatewayPagamento {
  private readonly transacoes = new Map<string, Transacao>();
  private sequencia = 0;

  constructor(private readonly prefixoId: string = 'tx_') {}

  processarPagamento(valor: number, dados: any): Transacao {
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Valor de pagamento inválido.');
    this.sequencia += 1;
    const transacao: Transacao = {
      id: `${this.prefixoId}${String(this.sequencia).padStart(6, '0')}`,
      valor,
      moeda: String(dados?.moeda ?? 'brl'),
      status: 'succeeded',
      dados: { ...dados },
    };
    this.transacoes.set(transacao.id, transacao);
    return transacao;
  }

  estornarPagamento(id: string): boolean {
    const transacao = this.transacoes.get(id);
    if (!transacao || transacao.status === 'refunded') return false;
    transacao.status = 'refunded';
    return true;
  }

  consultarStatus(id: string): string {
    return this.transacoes.get(id)?.status ?? 'not_found';
  }

  obterTransacao(id: string): Transacao | undefined {
    return this.transacoes.get(id);
  }
}
