import { FabricaProjeto, ValidadorProjeto } from './FabricaProjeto.js';
import { Projeto } from '../domain/entities/Projeto.js';
import { ProjetoDocumentario, ProjetoAnimacao, ProjetoPublicitario } from '../domain/entities/ProjetosEspecializados.js';
import { RecomendacaoStrategy } from '../strategies/RecomendacaoStrategy.js';
import { RegrasOrcamento } from '../strategies/RegrasOrcamento.js';
import { SimilaridadeCosseno } from '../strategies/SimilaridadeCosseno.js';
import { Observador } from '../observers/Observador.js';
import { EventoRecomendacao } from '../observers/EventoRecomendacao.js';

class ValidadorPorTipo implements ValidadorProjeto {
  constructor(private readonly tipo: string) {}
  validar(projeto: Projeto): boolean {
    if (projeto.genero.toLowerCase() !== this.tipo) return false;
    if (projeto.orcamento <= 0 || projeto.papeisObrigatorios.length === 0 || projeto.duracao <= 0) return false;
    if (!projeto.validarEstrutura()) return false;
    if (this.tipo === 'animacao' && projeto.restricoes.renderizacao3D === false) return false;
    if (this.tipo === 'publicitario' && projeto.restricoes.entregaRapida === false) return false;
    return true;
  }
}
class NotificadorPorTipo implements Observador {
  readonly eventosRecebidos: EventoRecomendacao[] = [];
  constructor(private readonly tipo: string) {}
  atualizar(evento: EventoRecomendacao): void {
    this.eventosRecebidos.push(new EventoRecomendacao(evento.tipo, new Map(evento.dados), `${this.tipo}:${evento.origem}`));
  }
}
abstract class FabricaBase implements FabricaProjeto {
  abstract readonly tipo: string;
  abstract criarProjeto(modelo: Projeto): Projeto;
  criarValidador(): ValidadorProjeto { return new ValidadorPorTipo(this.tipo); }
  criarRecomendador(): RecomendacaoStrategy { return this.tipo === 'animacao' ? new SimilaridadeCosseno() : new RegrasOrcamento(); }
  criarNotificador(): Observador { return new NotificadorPorTipo(this.tipo); }
}
export class FabricaDocumentario extends FabricaBase {
  readonly tipo = 'documentario';
  criarProjeto(p: Projeto): Projeto { return new ProjetoDocumentario(p.id,p.duracao,p.orcamento,new Date(p.prazo),[...p.papeisObrigatorios],structuredClone(p.restricoes),p.servicoPrincipal?.clonar()); }
}
export class FabricaAnimacao extends FabricaBase {
  readonly tipo = 'animacao';
  criarProjeto(p: Projeto): Projeto { return new ProjetoAnimacao(p.id,p.duracao,p.orcamento,new Date(p.prazo),[...p.papeisObrigatorios],structuredClone(p.restricoes),p.servicoPrincipal?.clonar()); }
}
export class FabricaPublicitario extends FabricaBase {
  readonly tipo = 'publicitario';
  criarProjeto(p: Projeto): Projeto { return new ProjetoPublicitario(p.id,p.duracao,p.orcamento,new Date(p.prazo),[...p.papeisObrigatorios],structuredClone(p.restricoes),p.servicoPrincipal?.clonar()); }
}
export class FabricaPadrao extends FabricaBase {
  readonly tipo = 'ficcao';
  criarProjeto(p: Projeto): Projeto { return p.clonar(); }
  override criarValidador(): ValidadorProjeto {
    return { validar: (p) => p.orcamento > 0 && p.duracao > 0 && p.papeisObrigatorios.length > 0 && p.validarEstrutura() };
  }
}
export function selecionarFabrica(genero: string): FabricaProjeto {
  switch (genero.trim().toLowerCase()) {
    case 'documentario': case 'documentário': return new FabricaDocumentario();
    case 'animacao': case 'animação': return new FabricaAnimacao();
    case 'publicitario': case 'publicitário': return new FabricaPublicitario();
    default: return new FabricaPadrao();
  }
}
