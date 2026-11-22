// Mantido por compatibilidade: a criação da aplicação agora vive em app.ts e o
// servidor é iniciado por main.ts (importar este arquivo não sobe mais o servidor).
export { criarApp, criarSistema } from './app.js';
export type { OpcoesApp } from './app.js';
