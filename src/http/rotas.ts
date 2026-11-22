import { FastifyInstance } from 'fastify';
import { SistemaRecomendacao } from '../observers/SistemaRecomendacao.js';
import { RecomendacaoRequestDTO, ProfissionalDTO, ProjetoDTO } from './DTOs.js';
import { converterProjeto, converterProfissional } from './conversores.js';

export interface RecomendacaoGeradaMensagem {
  tipo: 'RECOMENDACAO_GERADA';
  projeto: ProjetoDTO;
  equipe: {
    equipeId: string;
    status: string;
    membros: { papel: string; profissionalId: string; confirmado: boolean }[];
  };
  ocorridoEm: string;
}

// Ponte com a mensageria (RabbitMQ). É uma interface para que a API possa ser testada sem broker.
export interface Mensageria {
  consultarProfissionais(criterios: Record<string, unknown>): Promise<ProfissionalDTO[]>;
  publicarRecomendacao(mensagem: RecomendacaoGeradaMensagem): Promise<void>;
  saudavel(): boolean;
}

export class ErroMensageria extends Error {}

export function registrarRotas(
  app: FastifyInstance,
  sistemaRecomendacao: SistemaRecomendacao,
  mensageria?: Mensageria,
): void {
  app.get('/health', async (_request, reply) => {
    if (mensageria && !mensageria.saudavel()) {
      return reply.status(503).send({ status: 'indisponivel', rabbitmq: 'desconectado' });
    }
    return reply.status(200).send({ status: 'ok', rabbitmq: mensageria ? 'conectado' : 'nao-utilizado' });
  });

  app.post<{ Body: RecomendacaoRequestDTO }>('/recomendacoes', async (request, reply) => {
    try {
      const projeto = converterProjeto(request.body.projeto);

      let profissionaisDto = request.body.profissionais;
      if (profissionaisDto === undefined) {
        if (!mensageria) throw new Error('O campo "profissionais" é obrigatório.');
        profissionaisDto = await mensageria.consultarProfissionais({});
      }
      const profissionais = profissionaisDto.map(converterProfissional);

      const equipe = sistemaRecomendacao.executarRecomendacao(projeto, profissionais);

      const resposta = {
        equipeId: equipe.id,
        status: equipe.status,
        membros: equipe.membros.map((m) => ({
          papel: m.papel,
          profissionalId: m.profissional.id,
          confirmado: m.confirmado,
        })),
      };

      // Registro do projeto + notificações acontecem de forma assíncrona nos outros serviços.
      // Falha temporária da fila não derruba a resposta ao cliente.
      if (mensageria) {
        try {
          await mensageria.publicarRecomendacao({
            tipo: 'RECOMENDACAO_GERADA',
            projeto: request.body.projeto,
            equipe: resposta,
            ocorridoEm: new Date().toISOString(),
          });
        } catch (erro) {
          request.log.error({ erro }, 'Falha ao publicar a recomendação no RabbitMQ');
        }
      }

      return reply.status(200).send(resposta);
    } catch (erro) {
      const status = erro instanceof ErroMensageria ? 503 : 400;
      return reply.status(status).send({
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido ao processar a recomendação.',
      });
    }
  });
}
