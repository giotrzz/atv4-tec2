# Cinebridge — ATV IV

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