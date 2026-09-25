import { beforeEach, describe, expect, test } from 'vitest';
import { FakeAuthRepository, fakeHash, fakeVerifyPassword } from '../../test/support/fake_auth.js';
import { ANA, FERNANDA } from '../../test/support/users.js';
import { ABSOLUTE_TIMEOUT_MS, AuthService, IDLE_TIMEOUT_MS, TOUCH_INTERVAL_MS } from './auth.js';
import { InvalidCredentialsError, UnauthenticatedError } from './errors.js';

const DUMMY = fakeHash('hash-do-usuario-ficticio');
const MINUTE = 60_000;

let repo: FakeAuthRepository;
let clock: number;
let verifiedHashes: string[];
let service: AuthService;

beforeEach(() => {
  repo = new FakeAuthRepository();
  clock = Date.parse('2026-09-18T12:00:00Z');
  verifiedHashes = [];
  service = new AuthService(repo, {
    now: () => new Date(clock),
    today: () => '2026-09-18',
    verifyPassword: (hash, password) => {
      verifiedHashes.push(hash);
      return fakeVerifyPassword(hash, password);
    },
    dummyPasswordHash: DUMMY,
  });
});

describe('login', () => {
  test('credencial certa cria sessão e devolve o usuário sem hash', async () => {
    const result = await service.login(ANA.email, ANA.password);
    expect(result.user).toEqual({
      id: ANA.id,
      name: ANA.name,
      email: ANA.email,
      role: 'REQUESTER',
    });
    expect(result.expiresAt.getTime()).toBe(clock + ABSOLUTE_TIMEOUT_MS);
    expect(repo.sessions.size).toBe(1);
  });

  test('e-mail com maiúsculas e espaços é normalizado', async () => {
    await expect(service.login('  SOLICITANTE@gex.TEST ', ANA.password)).resolves.toBeDefined();
  });

  test('#13 usuário inexistente e senha errada: mesmo erro e a mesma verificação argon2', async () => {
    await expect(service.login(ANA.email, 'errada')).rejects.toThrow(InvalidCredentialsError);
    await expect(service.login('ninguem@gex.test', 'errada')).rejects.toThrow(
      InvalidCredentialsError,
    );
    // O inexistente também passa pela verificação, contra o hash fictício: os dois caminhos custam o mesmo.
    expect(verifiedHashes).toEqual([fakeHash(ANA.password), DUMMY]);
    expect(repo.sessions.size).toBe(0);
  });

  test('cada login gera uma sessão nova (sem fixation)', async () => {
    const a = await service.login(ANA.email, ANA.password);
    const b = await service.login(ANA.email, ANA.password);
    expect(a.token).not.toBe(b.token);
    expect(repo.sessions.size).toBe(2);
  });

  test('o banco guarda só o hash do token', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    const [stored] = [...repo.sessions.keys()];
    expect(stored).toHaveLength(64);
    expect(stored).not.toContain(Buffer.from(token, 'base64url').toString('hex'));
  });
});

describe('sessão: expiração com relógio injetado', () => {
  test('dentro dos limites, devolve o usuário com o papel do banco', async () => {
    const { token } = await service.login(FERNANDA.email, FERNANDA.password);
    clock += 29 * MINUTE;
    await expect(service.authenticate(token)).resolves.toMatchObject({ role: 'FINANCE' });
  });

  test('ociosa: 30 min sem uso → 401 e a sessão é apagada', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    clock += IDLE_TIMEOUT_MS;
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
    expect(repo.sessions.size).toBe(0);
  });

  test('absoluta: 8 h depois do login cai mesmo com uso contínuo', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    const end = clock + ABSOLUTE_TIMEOUT_MS;
    // Usa a cada 20 min: nunca fica ociosa.
    while (clock + 20 * MINUTE < end) {
      clock += 20 * MINUTE;
      await expect(service.authenticate(token)).resolves.toBeDefined();
    }
    clock = end;
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
  });

  test('last_seen_at é gravado no máximo 1× por minuto', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    clock += 10_000;
    await service.authenticate(token);
    clock += 10_000;
    await service.authenticate(token);
    expect(repo.touches).toHaveLength(0);
    clock += TOUCH_INTERVAL_MS;
    await service.authenticate(token);
    expect(repo.touches).toEqual([new Date(clock)]);
  });

  test('sem token, token vazio ou desconhecido → 401', async () => {
    await expect(service.authenticate(undefined)).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('')).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('nao-existe')).rejects.toThrow(UnauthenticatedError);
  });

  test('logout apaga a sessão', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    await service.logout(token);
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
  });
});
