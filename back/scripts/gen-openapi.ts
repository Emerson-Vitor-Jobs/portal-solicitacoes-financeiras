import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/repository/postgres/pool.js';

const neverConnectedPool = createPool('postgresql://localhost/never-connected');
const app = await buildApp(
  neverConnectedPool,
  {
    trustedProxyIp: false,
    appToday: undefined,
    cookieSecure: false,
    loginRateLimit: { perEmail: 5, perIp: 20, windowMs: 15 * 60_000 },
    logLevel: 'info',
  },
  { logger: false },
);
await app.ready();
await writeFile(
  new URL('../openapi.json', import.meta.url),
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
);
await app.close();
await neverConnectedPool.end();
console.log('openapi.json gerado');
