// Composition root: lê a config, monta as dependências à mão e sobe o servidor.
import { loadConfig } from './config.js';
import { buildServer } from './handler/http/server.js';
import { createPool, ping } from './repository/postgres/pool.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  const app = buildServer({
    trustProxy: config.trustProxy,
    health: { ping: () => ping(pool) },
  });

  // O Node roda como PID 1 no container (exec no entrypoint): sem handler, o SIGTERM do
  // `docker compose down` seria ignorado e o container só morreria no timeout.
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'encerrando');
    await app.close();
    await pool.end();
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      shutdown(signal).then(
        () => process.exit(0),
        (err: unknown) => {
          app.log.error({ err }, 'falha ao encerrar');
          process.exit(1);
        },
      );
    });
  }

  await app.listen({ host: '0.0.0.0', port: config.port });
}

main().catch((err: unknown) => {
  console.error('falha ao iniciar a API:', err);
  process.exit(1);
});
