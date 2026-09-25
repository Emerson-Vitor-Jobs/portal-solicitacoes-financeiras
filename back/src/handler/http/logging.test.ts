import { describe, expect, test } from 'vitest';
import { LogCapture } from '../../../test/support/log_capture.js';
import { CSRF, buildTestServer, loginAs } from '../../../test/support/server.js';
import { ANA } from '../../../test/support/users.js';
import { serializeError } from './logging.js';
import { SESSION_COOKIE } from './session.js';

describe('política de log (§14.5)', () => {
  test('erro de banco vira só { name, code }: detail, where e valores ficam de fora', () => {
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      name: 'error',
      code: '23505',
      detail: 'Key (supplier_cnpj, invoice_number)=(10000000000145, NF-2026-1001) already exists.',
      constraint: 'requests_supplier_cnpj_invoice_number_key',
      where: 'SQL statement "INSERT INTO requests …"',
    });
    expect(serializeError(pgError)).toEqual({ name: 'error', code: '23505' });
    expect(JSON.stringify(serializeError(pgError))).not.toContain('10000000000145');
  });

  test('valor que não é objeto também é reduzido', () => {
    expect(serializeError('boom')).toEqual({ name: 'string' });
  });

  test('a linha da requisição tem os campos da política e nada de senha, cookie ou corpo', async () => {
    const logs = new LogCapture();
    const { app } = await buildTestServer({ logStream: logs });
    const cookie = await loginAs(app, ANA);
    await app.inject({ method: 'GET', url: '/api/auth/me?x=segredo', headers: { cookie } });
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: CSRF,
      payload: { email: ANA.email, password: 'senha-errada-no-log' },
    });
    await app.close();

    const text = logs.text;
    expect(text).not.toContain(ANA.password);
    expect(text).not.toContain('senha-errada-no-log');
    expect(text).not.toContain(cookie.slice(`${SESSION_COOKIE}=`.length));
    expect(text).not.toContain('segredo');

    const requests = logs.entries().filter((e) => e.msg === 'request completed');
    expect(requests).toHaveLength(3);
    expect(requests[1]).toMatchObject({
      method: 'GET',
      route: '/api/auth/me',
      status: 200,
      user_id: ANA.id,
    });
    expect(requests[1]).toHaveProperty('request_id');
    expect(requests[1]).toHaveProperty('duration_ms');
    expect(requests[2]).toMatchObject({ route: '/api/auth/login', status: 401, user_id: null });
  });
});
