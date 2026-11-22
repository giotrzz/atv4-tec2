# Cinebridge — ATV III (Adapter, Composite, Decorator) + ATV IV (containers)

Repositório da ATV II evoluído para a ATV III e ATV IV. A raiz do projeto é o serviço **cinebridge-api**;
os outros três microsserviços ficam em `services/`.

```
.
├── docker-compose.yml          # orquestra 4 serviços + 3 bancos + RabbitMQ
├── Dockerfile                  # cinebridge-api (node:18-alpine)
├── env/                        # variáveis de ambiente de cada container (.env)
├── src/                        # cinebridge-api  (ATV I–III)
│   ├── adapters/               # ATV III – Adapter
│   ├── composite/              # ATV III – Composite
│   ├── decorators/             # ATV III – Decorator
│   └── mensageria/             # ATV IV – RabbitMQ (amqplib)
├── tests/
└── services/
    ├── profissionais/          # cinebridge-profissionais (+ profissionais-db)
    ├── projetos/               # cinebridge-projetos      (+ projetos-db)
    └── notificacoes/           # cinebridge-notificacoes  (+ notificacoes-db)
```

## ATV III

### Adapter
| Interface (contrato do núcleo) | Sistema externo simulado | Adaptadores |
|---|---|---|
| `AdaptadorArmazenamento` | `ArmazenamentoExterno` (upload/download/listar) | `AdaptadorS3`, `AdaptadorGoogleCloud`, `AdaptadorLocal` |
| `AdaptadorPagamento` | `GatewayPagamento` (processar/estornar/consultarStatus) | `AdaptadorStripe` (centavos), `AdaptadorPagSeguro`, `AdaptadorPayPal` |
| `AdaptadorProfissional` | `ApiProfissionalExterna` (formato snake_case) | `AdaptadorLinkedIn` (escala 1–5 → 0–10), `AdaptadorIndeed`, `AdaptadorInterno` |

`SistemaRecomendacao` recebe os adaptadores no construtor ou via `configurarAdaptadores(armazenamento, pagamento, profissional)`
e só conhece as interfaces. Usos reais no núcleo: `executarRecomendacao(projeto)` busca candidatos no `AdaptadorProfissional` quando
a lista não é informada e arquiva o relatório do projeto no `AdaptadorArmazenamento`; `efetuarPagamentoEquipe(equipe)` paga cada membro pelo gateway configurado.

### Composite
`ServicoProjeto` (`calcularCusto`, `listarSubservicos`, `obterPrazo`, `validar`) → `ServicoAtomico` (folha) e `PacoteServico` (pode conter
atômicos ou outros pacotes, em modo `sequencial` = soma dos prazos ou `paralelo` = maior prazo). `Projeto` ganhou `servicoPrincipal`;
`calcularCustoTotal()` delega a ele e a validação (`validarEstrutura()`) é recursiva e já participa do orquestrador, das fábricas e do `ValidadorConsistencia`.

### Decorator
`RecomendadorBase` + `CacheDecorator`, `AuditoriaDecorator`, `CompressaoDecorator`, todos `RecomendacaoStrategy`.
A pilha é montada em tempo de execução por `PilhaDecoradores` (ex.: `"cache,auditoria,compressao"`, da esquerda para a direita = do mais interno ao mais externo)
e instalada com `sistema.definirDecoradores(...)` — sem alterar `SistemaRecomendacao`. Nos containers, use a variável `DECORADORES` em `env/api.env`.

### Interpretações (não estão no enunciado — vale validar com o professor)
- **Compressão**: `RecomendacaoStrategy` devolve um `Map`, não bytes. A compressão mantém só os N melhores candidatos por papel e expõe `comprimirParaTransmissao()` (gzip) e o relatório de bytes antes/depois.
- **Prazo de pacote**: o enunciado não diz como combinar prazos; adotei soma (sequencial, padrão) ou máximo (paralelo).
- `Projeto` mantém `papeisObrigatorios` (derivado do `servicoPrincipal` quando a lista vem vazia) para não quebrar as atividades anteriores.
- `RecomendadorBase` delega a uma estratégia existente (padrão: `SimilaridadeCosseno`).

## ATV IV

```
 cliente ──HTTP──► cinebridge-api :3000
                        │  RPC  (consulta-profissionais, fila de retorno única por requisição)
                        ▼
                  cinebridge-mq (RabbitMQ) :5672 / :15672 ──► cinebridge-profissionais :3001 ──► profissionais-db
                        │  registro-projetos
                        ▼
                  cinebridge-projetos :3002 ──► projetos-db
                        │  eventos-projetos
                        ▼
                  cinebridge-notificacoes :3003 ──► notificacoes-db
```
Rede: `cinebridge-net` (bridge). Filas duráveis, mensagens persistentes e canal com confirmação de entrega. Cada serviço expõe `GET /health`
(verifica Postgres e RabbitMQ) e o compose usa `curl -f` / `pg_isready` / `rabbitmq-diagnostics ping` como healthcheck, com `depends_on: service_healthy`.

### Executar
Requisitos: Docker Desktop (Windows 10+) ou Docker Engine + Compose (Ubuntu 24.04+).

```bash
docker --version && docker compose version     # ou: docker-compose --version
docker compose up -d --build                   # ou: docker-compose up -d --build
docker compose ps                              # aguarde todos "healthy"
docker compose logs -f
```

### Testar o fluxo completo
Linux/macOS:
```bash
curl -s -X POST http://localhost:3000/recomendacoes -H "Content-Type: application/json" -d '{
  "projeto": {"id":"proj-demo","genero":"animacao","duracao":90,"orcamento":60000,
              "prazo":"2026-12-31T00:00:00.000Z","papeisObrigatorios":["DIRETOR","EFEITOS_VISUAIS","SONOPLASTA"]}
}'
```
Windows (PowerShell):
```powershell
$body = '{"projeto":{"id":"proj-demo","genero":"animacao","duracao":90,"orcamento":60000,"prazo":"2026-12-31T00:00:00.000Z","papeisObrigatorios":["DIRETOR","EFEITOS_VISUAIS","SONOPLASTA"]}}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/recomendacoes -ContentType "application/json" -Body $body
```
Resposta esperada: DIRETOR=`prof-001`, EFEITOS_VISUAIS=`prof-005`, SONOPLASTA=`prof-004` (profissionais vindos do `cinebridge-profissionais` via RabbitMQ).

Conferir o restante da cadeia:
```bash
curl http://localhost:3002/projetos/proj-demo     # projeto registrado + recomendações
curl http://localhost:3003/notificacoes           # e-mail / notificação interna geradas
curl -X POST http://localhost:3002/projetos/proj-demo/finalizar   # gera PROJETO_FINALIZADO
```
Interface do RabbitMQ: <http://localhost:15672> (`guest` / `guest`) → aba *Queues*.
Resiliência: `docker compose stop cinebridge-notificacoes`, gere recomendações, `docker compose start cinebridge-notificacoes` — as mensagens ficam na fila e são consumidas depois.

### Desenvolvimento local (sem Docker)
```bash
npm install
npm test
npm run typecheck
npm run dev        # sobe a API em :3000 (sem RABBITMQ_URL, funciona como na ATV II: exige "profissionais" no corpo)
```

## Mudanças em relação ao repositório da ATV II
- `src/index.ts` não sobe mais o servidor ao ser importado; a criação do app está em `src/app.ts` e a inicialização em `src/main.ts` (`npm run dev`/`npm start`).
- **Fastify 5 → 4**: o Fastify 5 exige Node ≥ 20 e a ATV IV manda usar `node:18-alpine`. A API usada no projeto é a mesma. Se o professor aceitar `node:20-alpine`, pode voltar para a 5.
- Dependências novas: `amqplib` (e `pg` nos serviços). Rode `npm install` para regenerar o `package-lock.json`.
- Senhas em `env/*.env` são só de desenvolvimento; troque-as para qualquer ambiente real.
