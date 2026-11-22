# Cinebridge — Atividade prática ATVII

## O que foi implementado

- **Prototype:** `Projeto.clonar()` realiza cópia independente dos papéis, da data e das restrições; `ProjetoDocumentario`, `ProjetoAnimacao` e `ProjetoPublicitario` mantêm o tipo concreto ao clonar.
- **Factory Method / Abstract Factory:** `FabricaProjeto` declara a criação do projeto, validador, recomendador e notificador. As fábricas concretas são `FabricaDocumentario`, `FabricaAnimacao` e `FabricaPublicitario`.
- **Orquestração desacoplada:** `OrquestradorEquipe` recebe uma fábrica por construtor (com fábrica padrão para compatibilidade) e consulta o validador fornecido por ela.
- **Seleção automática:** `SistemaRecomendacao` seleciona a família de objetos a partir do gênero informado. Os notificadores específicos passam a integrar o mecanismo Observer já existente.
- **Testes:** adicionados testes para cópia profunda, criação de famílias de objetos e recomendação com fábrica especializada.

## Executar

Requer Node.js compatível com o projeto.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

A API permanece disponível em `http://localhost:3000`, com `POST /recomendacoes`.

## Gêneros reconhecidos

`documentario` / `documentário`, `animacao` / `animação` e `publicitario` / `publicitário`. Outros gêneros preservam o comportamento padrão da atividade anterior.
