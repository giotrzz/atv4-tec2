import { Mensageria, RecomendacaoGeradaMensagem, ErroMensageria } from '../http/rotas.js';
import { ProfissionalDTO } from '../http/DTOs.js';
import { ConexaoRabbit, chamarRpc, publicar, FILA_CONSULTA_PROFISSIONAIS, FILA_REGISTRO_PROJETOS } from './rabbit.js';

export class MensageriaRabbit implements Mensageria {
  constructor(private readonly conexao: ConexaoRabbit) {}

  async consultarProfissionais(criterios: Record<string, unknown>): Promise<ProfissionalDTO[]> {
    try {
      const resposta = await chamarRpc<{ profissionais: ProfissionalDTO[] }>(
        this.conexao.canal, FILA_CONSULTA_PROFISSIONAIS, { criterios },
      );
      return resposta.profissionais;
    } catch (erro) {
      throw new ErroMensageria(`Falha ao consultar profissionais via RabbitMQ: ${erro instanceof Error ? erro.message : erro}`);
    }
  }

  async publicarRecomendacao(mensagem: RecomendacaoGeradaMensagem): Promise<void> {
    await publicar(this.conexao.canal, FILA_REGISTRO_PROJETOS, mensagem);
  }

  saudavel(): boolean {
    return this.conexao.saudavel();
  }
}
