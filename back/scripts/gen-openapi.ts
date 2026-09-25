// Gera back/openapi.json a partir dos schemas Zod das rotas (DECISOES_FUNDACAO §2).
// Não precisa de banco: o app é montado sem abrir porta e sem conexão.
import { writeFile } from 'node:fs/promises';
import { buildServer } from '../src/handler/http/server.js';

const app = await buildServer({
  trustProxy: false,
  logger: false,
  health: { ping: () => Promise.reject(new Error('sem banco na geração do contrato')) },
});
await app.ready();
await writeFile(
  new URL('../openapi.json', import.meta.url),
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
);
await app.close();
console.log('openapi.json gerado');
