import { AdaptadorArmazenamento } from './AdaptadorArmazenamento.js';
import { ArmazenamentoExterno } from './ArmazenamentoExterno.js';

// Base comum: traduz salvar/recuperar/listar para upload/download/listar do sistema externo.
// Cada provedor concreto define o seu "espaço de nomes" (bucket, projeto, diretório) e esquema de ID.
abstract class AdaptadorArmazenamentoBase implements AdaptadorArmazenamento {
  protected constructor(
    protected readonly cliente: ArmazenamentoExterno,
    protected readonly raiz: string,
  ) {}

  salvarArquivo(conteudo: Buffer, metadados: any): string {
    const nome = String(metadados?.nome ?? metadados?.caminho ?? '').trim();
    if (!nome) throw new Error('metadados.nome é obrigatório para salvar um arquivo.');
    return this.cliente.upload({ nome: `${this.raiz}/${nome}`, conteudo, metadados: { ...metadados } });
  }

  recuperarArquivo(id: string): Buffer {
    return this.cliente.download(id).conteudo;
  }

  listarArquivos(prefixo: string): string[] {
    return this.cliente.listar(`${this.raiz}/${prefixo}`);
  }
}

export class AdaptadorS3 extends AdaptadorArmazenamentoBase {
  constructor(bucket = 'cinebridge-midia', cliente = new ArmazenamentoExterno('s3')) {
    super(cliente, bucket);
  }
}

export class AdaptadorGoogleCloud extends AdaptadorArmazenamentoBase {
  constructor(projeto = 'cinebridge-gcs', cliente = new ArmazenamentoExterno('gs')) {
    super(cliente, projeto);
  }
}

export class AdaptadorLocal extends AdaptadorArmazenamentoBase {
  constructor(diretorio = 'cinebridge-local', cliente = new ArmazenamentoExterno('file')) {
    super(cliente, diretorio);
  }
}
