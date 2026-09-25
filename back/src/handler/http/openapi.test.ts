import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { buildTestServer } from '../../../test/support/server.js';

// Contrato congelado: o openapi.json commitado (fonte dos tipos do front) tem que ser exatamente o que as rotas
// geram. Mudou uma rota ou um schema? Rode `npm run gen:openapi` e, no front, `npm run gen:api`.
test('openapi.json commitado está em dia com as rotas', async () => {
  const { app } = await buildTestServer();
  const committed: unknown = JSON.parse(
    await readFile(new URL('../../../openapi.json', import.meta.url), 'utf8'),
  );
  expect(app.swagger()).toEqual(committed);
  await app.close();
});
