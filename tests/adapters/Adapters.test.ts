import { describe, it, expect } from 'vitest';
import { SistemaRecomendacao } from '../../src/observers/SistemaRecomendacao.js';
import { OrquestradorPadrao } from '../../src/orchestration/OrquestradorPadrao.js';
import { RegrasOrcamento } from '../../src/strategies/RegrasOrcamento.js';
import { Projeto } from '../../src/domain/entities/Projeto.js';
import { Profissional } from '../../src/domain/entities/Profissional.js';
import { Papel } from '../../src/domain/enums/Papel.js';
import { AdaptadorArmazenamento } from '../../src/adapters/armazenamento/AdaptadorArmazenamento.js';
import { AdaptadorS3, AdaptadorGoogleCloud, AdaptadorLocal } from '../../src/adapters/armazenamento/AdaptadoresArmazenamento.js';
import { AdaptadorPagamento } from '../../src/adapters/pagamento/AdaptadorPagamento.js';
import { AdaptadorStripe, AdaptadorPagSeguro, AdaptadorPayPal } from '../../src/adapters/pagamento/AdaptadoresPagamento.js';
import { GatewayPagamento } from '../../src/adapters/pagamento/GatewayPagamento.js';
import { ApiProfissionalExterna, PerfilExterno } from '../../src/adapters/profissional/ApiProfissionalExterna.js';
import { AdaptadorLinkedIn, AdaptadorIndeed, AdaptadorInterno } from '../../src/adapters/profissional/AdaptadoresProfissional.js';
import { AdaptadorProfissional } from '../../src/adapters/profissional/AdaptadorProfissional.js';
import { AuditoriaRecomendacao } from '../../src/observers/AuditoriaRecomendacao.js';

const perfis: PerfilExterno[] = [
  { id: 'x1', nome_completo: 'Ana Externa', habilidades: [{ nome: 'Direção', nivel: 4 }], tarifa: 3000,
    disponivel_de: '2026-01-01', disponivel_ate: '2026-12-31', notas: [5, 4] },
  { id: 'x2', nome_completo: 'Beto Externo', habilidades: [{ nome: 'Edição', nivel: 5 }], tarifa: 9000,
    disponivel_de: '2026-01-01', disponivel_ate: '2026-12-31', notas: [] },
];

function projeto(): Projeto {
  return new Projeto('proj-ad', 'Ficção', 90, 10000, new Date('2026-12-01'), [Papel.DIRETOR]);
}

describe('Adapter — armazenamento', () => {
  const provedores: [string, () => AdaptadorArmazenamento, string][] = [
    ['S3', () => new AdaptadorS3(), 's3://'],
    ['Google Cloud', () => new AdaptadorGoogleCloud(), 'gs://'],
    ['Local', () => new AdaptadorLocal(), 'file://'],
  ];

  for (const [nome, criar, esquema] of provedores) {
    it(`${nome}: salva, recupera e lista arquivos pelo mesmo contrato`, () => {
      const adaptador = criar();
      const conteudo = Buffer.from('roteiro v1');
      const id = adaptador.salvarArquivo(conteudo, { nome: 'roteiros/v1.txt' });

      expect(id.startsWith(esquema)).toBe(true);
      expect(adaptador.recuperarArquivo(id).toString()).toBe('roteiro v1');
      expect(adaptador.listarArquivos('roteiros/')).toEqual([id]);
      expect(adaptador.listarArquivos('outros/')).toHaveLength(0);
    });
  }

  it('rejeita metadados sem nome e arquivo inexistente', () => {
    const adaptador = new AdaptadorS3();
    expect(() => adaptador.salvarArquivo(Buffer.from('x'), {})).toThrow();
    expect(() => adaptador.recuperarArquivo('s3://nao-existe')).toThrow();
  });
});

describe('Adapter — pagamento', () => {
  const provedores: [string, () => AdaptadorPagamento][] = [
    ['Stripe', () => new AdaptadorStripe()],
    ['PagSeguro', () => new AdaptadorPagSeguro()],
    ['PayPal', () => new AdaptadorPayPal()],
  ];

  for (const [nome, criar] of provedores) {
    it(`${nome}: efetua, verifica e cancela pagamento pelo mesmo contrato`, () => {
      const adaptador = criar();
      const id = adaptador.efetuarPagamento(150.5, 'produtor-1', 'prof-1');

      expect(adaptador.verificarPagamento(id)).toBe('APROVADO');
      expect(adaptador.cancelarPagamento(id)).toBe(true);
      expect(adaptador.verificarPagamento(id)).toBe('ESTORNADO');
      expect(adaptador.cancelarPagamento(id)).toBe(false);
      expect(adaptador.verificarPagamento('inexistente')).toBe('DESCONHECIDO');
    });
  }

  it('Stripe traduz o valor para centavos e PagSeguro mantém reais', () => {
    const gatewayStripe = new GatewayPagamento('pi_');
    const gatewayPagSeguro = new GatewayPagamento('PS-');
    const idStripe = new AdaptadorStripe(gatewayStripe).efetuarPagamento(10.5, 'a', 'b');
    const idPagSeguro = new AdaptadorPagSeguro(gatewayPagSeguro).efetuarPagamento(10.5, 'a', 'b');

    expect(gatewayStripe.obterTransacao(idStripe)?.valor).toBe(1050);
    expect(gatewayPagSeguro.obterTransacao(idPagSeguro)?.valor).toBe(10.5);
  });

  it('rejeita valor inválido e partes vazias', () => {
    expect(() => new AdaptadorStripe().efetuarPagamento(0, 'a', 'b')).toThrow();
    expect(() => new AdaptadorPayPal().efetuarPagamento(10, '', 'b')).toThrow();
  });
});

describe('Adapter — profissionais', () => {
  it('LinkedIn converte escala 1-5 para 0-10; Indeed mantém a escala; Interno não traduz', () => {
    const linkedin = new AdaptadorLinkedIn(new ApiProfissionalExterna(perfis));
    const indeed = new AdaptadorIndeed(new ApiProfissionalExterna(perfis));

    expect(linkedin.detalharProfissional('x1').competencias[0]?.nivel).toBe(8);
    expect(indeed.detalharProfissional('x1').competencias[0]?.nivel).toBe(4);
    expect(linkedin.detalharProfissional('x1').nome).toBe('Ana Externa');
    expect(linkedin.detalharProfissional('x1').avaliacoes).toHaveLength(2);

    const interno = new AdaptadorInterno([
      new Profissional('i1', 'Interna', [], { inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') }, 1000),
    ]);
    expect(interno.detalharProfissional('i1').nome).toBe('Interna');
  });

  it('traduz critérios do sistema para filtros externos', () => {
    const adaptador = new AdaptadorLinkedIn(new ApiProfissionalExterna(perfis));
    expect(adaptador.listarProfissionais({ precoMax: 5000 }).map((p) => p.id)).toEqual(['x1']);
    expect(adaptador.listarProfissionais({ competencia: 'Edição' }).map((p) => p.id)).toEqual(['x2']);
    expect(adaptador.listarProfissionais({})).toHaveLength(2);
  });

  it('registra avaliações em cada provedor e valida a nota', () => {
    const adaptador = new AdaptadorIndeed(new ApiProfissionalExterna(perfis));
    adaptador.registrarAvaliacao('x2', { nota: 4 });
    expect(adaptador.detalharProfissional('x2').avaliacoes).toHaveLength(1);
    expect(() => adaptador.registrarAvaliacao('x2', { nota: 9 })).toThrow();
    expect(() => adaptador.detalharProfissional('nao-existe')).toThrow();
  });
});

describe('Adapter — troca de provedor sem alterar a lógica de negócio (SistemaRecomendacao)', () => {
  function criarSistema(): SistemaRecomendacao {
    return new SistemaRecomendacao(new OrquestradorPadrao(), new RegrasOrcamento());
  }

  it('executa a mesma recomendação com qualquer AdaptadorProfissional', () => {
    const adaptadores: AdaptadorProfissional[] = [
      new AdaptadorLinkedIn(new ApiProfissionalExterna(perfis)),
      new AdaptadorIndeed(new ApiProfissionalExterna(perfis)),
      new AdaptadorInterno([new Profissional('i1', 'Interna', [], { inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') }, 2000)]),
    ];

    const esperados = ['x1', 'x1', 'i1'];
    adaptadores.forEach((adaptador, i) => {
      const sistema = criarSistema();
      sistema.configurarAdaptadores(new AdaptadorS3(), new AdaptadorStripe(), adaptador);
      const equipe = sistema.executarRecomendacao(projeto()); // sem lista: vem do adaptador
      expect(equipe.membros[0]?.profissional.id).toBe(esperados[i]);
    });
  });

  it('arquiva o relatório no armazenamento configurado e permite trocar o provedor', () => {
    for (const armazenamento of [new AdaptadorS3(), new AdaptadorGoogleCloud(), new AdaptadorLocal()]) {
      const sistema = criarSistema();
      const auditoria = new AuditoriaRecomendacao();
      sistema.adicionarObservador(auditoria);
      sistema.configurarAdaptadores(armazenamento, new AdaptadorStripe(), new AdaptadorInterno([
        new Profissional('i1', 'Interna', [], { inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') }, 2000),
      ]));

      sistema.executarRecomendacao(projeto());

      const arquivoId = auditoria.eventosRecebidos[0]?.dados.get('relatorioArquivoId') as string;
      expect(armazenamento.recuperarArquivo(arquivoId).toString()).toContain('proj-ad');
    }
  });

  it('paga a equipe por qualquer gateway configurado', () => {
    for (const pagamento of [new AdaptadorStripe(), new AdaptadorPagSeguro(), new AdaptadorPayPal()]) {
      const sistema = criarSistema();
      sistema.configurarAdaptadores(new AdaptadorLocal(), pagamento, new AdaptadorInterno());
      const prof = new Profissional('i1', 'Interna', [], { inicio: new Date('2026-01-01'), fim: new Date('2026-12-31') }, 2000);
      const equipe = sistema.executarRecomendacao(projeto(), [prof]);

      const ids = sistema.efetuarPagamentoEquipe(equipe);
      expect(ids).toHaveLength(1);
      expect(pagamento.verificarPagamento(ids[0] as string)).toBe('APROVADO');
    }
  });

  it('falha de forma clara quando não há lista nem adaptador de profissionais', () => {
    expect(() => criarSistema().executarRecomendacao(projeto())).toThrow();
    expect(() => criarSistema().efetuarPagamentoEquipe(criarSistema().executarRecomendacao(projeto(), [
      new Profissional('p', 'P', [], { inicio: new Date(), fim: new Date() }, 100),
    ]))).toThrow();
  });
});
