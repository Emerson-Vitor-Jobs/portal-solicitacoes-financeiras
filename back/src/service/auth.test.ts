import { beforeEach, describe, expect, test } from 'vitest';
import { FakeAuthRepository, fakeHash, fakeVerifyPassword } from '../../test/support/fake_auth.js';
import { ANA, FERNANDA } from '../../test/support/users.js';
import {
  ABSOLUTE_TIMEOUT_MS,
  AuthService,
  IDLE_TIMEOUT_MS,
  LAST_SEEN_WRITE_INTERVAL_MS,
} from './auth.js';
import { InvalidCredentialsError, UnauthenticatedError } from './errors.js';

const DUMMY = fakeHash('dummy-user-hash');
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
  test('valid credentials create a session and return the user without the hash', async () => {
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

  test('an e-mail with uppercase and spaces is normalized', async () => {
    await expect(service.login('  SOLICITANTE@gex.TEST ', ANA.password)).resolves.toBeDefined();
  });

  test('#13 unknown user and wrong password: same error and the same argon2 verification', async () => {
    await expect(service.login(ANA.email, 'wrong')).rejects.toThrow(InvalidCredentialsError);
    await expect(service.login('nobody@gex.test', 'wrong')).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(verifiedHashes).toEqual([fakeHash(ANA.password), DUMMY]);
    expect(repo.sessions.size).toBe(0);
  });

  test('each login creates a new session (no fixation)', async () => {
    const a = await service.login(ANA.email, ANA.password);
    const b = await service.login(ANA.email, ANA.password);
    expect(a.token).not.toBe(b.token);
    expect(repo.sessions.size).toBe(2);
  });

  test('the database stores only the token hash', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    const [stored] = [...repo.sessions.keys()];
    expect(stored).toHaveLength(64);
    expect(stored).not.toContain(Buffer.from(token, 'base64url').toString('hex'));
  });
});

describe('session: expiration with an injected clock', () => {
  test('within the limits, returns the user with the role from the database', async () => {
    const { token } = await service.login(FERNANDA.email, FERNANDA.password);
    clock += 29 * MINUTE;
    await expect(service.authenticate(token)).resolves.toMatchObject({ role: 'FINANCE' });
  });

  test('idle: 30 min without use → 401 and the session is deleted', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    clock += IDLE_TIMEOUT_MS;
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
    expect(repo.sessions.size).toBe(0);
  });

  test('absolute: 8 h after login it expires even with continuous use', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    const end = clock + ABSOLUTE_TIMEOUT_MS;
    while (clock + 20 * MINUTE < end) {
      clock += 20 * MINUTE;
      await expect(service.authenticate(token)).resolves.toBeDefined();
    }
    clock = end;
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
  });

  test('last_seen_at is written at most once per minute', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    clock += 10_000;
    await service.authenticate(token);
    clock += 10_000;
    await service.authenticate(token);
    expect(repo.touches).toHaveLength(0);
    clock += LAST_SEEN_WRITE_INTERVAL_MS;
    await service.authenticate(token);
    expect(repo.touches).toEqual([new Date(clock)]);
  });

  test('missing, empty or unknown token → 401', async () => {
    await expect(service.authenticate(undefined)).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('')).rejects.toThrow(UnauthenticatedError);
    await expect(service.authenticate('does-not-exist')).rejects.toThrow(UnauthenticatedError);
  });

  test('logout deletes the session', async () => {
    const { token } = await service.login(ANA.email, ANA.password);
    await service.logout(token);
    await expect(service.authenticate(token)).rejects.toThrow(UnauthenticatedError);
  });
});
