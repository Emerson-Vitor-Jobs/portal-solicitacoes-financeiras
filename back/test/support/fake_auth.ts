// Fake escrito à mão da porta AuthRepository (sem vi.mock): guarda tudo em memória.
import type {
  AuthRepository,
  NewSession,
  StoredSession,
  UserCredentials,
} from '../../src/service/auth.js';
import { SEED_USERS } from './users.js';

// Hash "falso" legível: o fake de verifyPassword só compara com o prefixo. O argon2 real fica na integração.
export const fakeHash = (password: string) => `fake:${password}`;
export const fakeVerifyPassword = (passwordHash: string, password: string) =>
  Promise.resolve(passwordHash === fakeHash(password));

export class FakeAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserCredentials>();
  readonly sessions = new Map<string, NewSession & { lastSeenAt: Date }>();
  readonly touches: Date[] = [];

  constructor() {
    for (const { password, ...user } of SEED_USERS) {
      this.users.set(user.email, { ...user, passwordHash: fakeHash(password) });
    }
  }

  findUserByEmail(email: string): Promise<UserCredentials | null> {
    return Promise.resolve(this.users.get(email) ?? null);
  }

  createSession(session: NewSession): Promise<void> {
    this.sessions.set(session.idHash.toString('hex'), { ...session, lastSeenAt: session.now });
    return Promise.resolve();
  }

  findSession(idHash: Buffer): Promise<StoredSession | null> {
    const s = this.sessions.get(idHash.toString('hex'));
    if (!s) return Promise.resolve(null);
    const user = [...this.users.values()].find((u) => u.id === s.userId);
    if (!user) return Promise.resolve(null);
    return Promise.resolve({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      createdAt: s.now,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
    });
  }

  touchSession(idHash: Buffer, now: Date): Promise<void> {
    const s = this.sessions.get(idHash.toString('hex'));
    if (s) s.lastSeenAt = now;
    this.touches.push(now);
    return Promise.resolve();
  }

  deleteSession(idHash: Buffer): Promise<void> {
    this.sessions.delete(idHash.toString('hex'));
    return Promise.resolve();
  }
}
