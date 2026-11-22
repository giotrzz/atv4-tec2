import { AdaptadorPagamento } from './AdaptadorPagamento.js';
import { GatewayPagamento } from './GatewayPagamento.js';

function exigirPartes(origem: string, destino: string): void {
  if (!origem?.trim() || !destino?.trim()) throw new Error('Origem e destino do pagamento são obrigatórios.');
}

// Normaliza o status do gateway para o vocabulário do sistema.
function normalizarStatus(statusExterno: string): string {
  switch (statusExterno) {
    case 'succeeded': return 'APROVADO';
    case 'refunded': return 'ESTORNADO';
    default: return 'DESCONHECIDO';
  }
}

// Stripe trabalha com a menor unidade da moeda (centavos).
export class AdaptadorStripe implements AdaptadorPagamento {
  constructor(private readonly gateway = new GatewayPagamento('pi_')) {}

  efetuarPagamento(valor: number, origem: string, destino: string): string {
    exigirPartes(origem, destino);
    const centavos = Math.round(valor * 100);
    return this.gateway.processarPagamento(centavos, { moeda: 'brl', customer: origem, destination: destino, provedor: 'stripe' }).id;
  }
  cancelarPagamento(id: string): boolean { return this.gateway.estornarPagamento(id); }
  verificarPagamento(id: string): string { return normalizarStatus(this.gateway.consultarStatus(id)); }
}

// PagSeguro recebe o valor decimal em reais.
export class AdaptadorPagSeguro implements AdaptadorPagamento {
  constructor(private readonly gateway = new GatewayPagamento('PS-')) {}

  efetuarPagamento(valor: number, origem: string, destino: string): string {
    exigirPartes(origem, destino);
    return this.gateway.processarPagamento(valor, { moeda: 'BRL', pagador: origem, recebedor: destino, provedor: 'pagseguro' }).id;
  }
  cancelarPagamento(id: string): boolean { return this.gateway.estornarPagamento(id); }
  verificarPagamento(id: string): string { return normalizarStatus(this.gateway.consultarStatus(id)); }
}

export class AdaptadorPayPal implements AdaptadorPagamento {
  constructor(private readonly gateway = new GatewayPagamento('PAY-')) {}

  efetuarPagamento(valor: number, origem: string, destino: string): string {
    exigirPartes(origem, destino);
    return this.gateway.processarPagamento(valor, { moeda: 'BRL', payer: origem, payee: destino, provedor: 'paypal' }).id;
  }
  cancelarPagamento(id: string): boolean { return this.gateway.estornarPagamento(id); }
  verificarPagamento(id: string): string { return normalizarStatus(this.gateway.consultarStatus(id)); }
}
