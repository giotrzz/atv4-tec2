export interface ArquivoExterno {
  nome: string;
  conteudo: Buffer;
  metadados: Record<string, unknown>;
}

// Sistema externo SIMULADO de armazenamento de objetos (imita a API de um provedor de nuvem).
// Seu vocabulário (upload/download/listar) difere do contrato do sistema (salvar/recuperar/listar).
export class ArmazenamentoExterno {
  private readonly arquivos = new Map<string, ArquivoExterno>();
  private sequencia = 0;

  constructor(private readonly esquema: string = 'ext') {}

  upload(arquivo: ArquivoExterno): string {
    this.sequencia += 1;
    const id = `${this.esquema}://${arquivo.nome}#${this.sequencia}`;
    this.arquivos.set(id, { ...arquivo, conteudo: Buffer.from(arquivo.conteudo) });
    return id;
  }

  download(id: string): ArquivoExterno {
    const arquivo = this.arquivos.get(id);
    if (!arquivo) throw new Error(`Arquivo não encontrado: ${id}`);
    return { ...arquivo, conteudo: Buffer.from(arquivo.conteudo) };
  }

  listar(pasta: string): string[] {
    const prefixo = `${this.esquema}://${pasta}`;
    return [...this.arquivos.keys()].filter((id) => id.startsWith(prefixo));
  }
}
