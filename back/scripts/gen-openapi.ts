// Gera back/openapi.json a partir dos schemas Zod das rotas (DECISOES_FUNDACAO §2).
// Não precisa de banco: o app é montado sem abrir porta, e o pool do pg só conecta na primeira query (nunca feita).
import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/repository/postgres/pool.js';

const pool = createPool('postgresql://localhost/sem-conexao-na-geracao-do-contrato');
const app = await buildApp(
  pool,
  {
    trustProxy: false,
    appToday: undefined,
    cookieSecure: false,
    loginRateLimit: { perEmail: 5, perIp: 20, windowMs: 15 * 60_000 },
  },
  { logger: false },
);
await app.ready();
await writeFile(
  new URL('../openapi.json', import.meta.url),
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
);
await app.close();
await pool.end();
console.log('openapi.json gerado');
