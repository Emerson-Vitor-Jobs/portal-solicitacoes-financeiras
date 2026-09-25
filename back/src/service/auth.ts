import { hashSessionToken, newSessionToken } from '../modules/session_token.js';
import type { User } from '../types/domain.js';
import { InvalidCredentialsError, UnauthenticatedError } from './errors.js';

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
export const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

export interface UserCredentials extends User {
  passwordHash: string;
}

export interface StoredSession {
  user: User;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface NewSession {
  idHash: Buffer;
  userId: string;
  now: Date;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserCredentials | null>;
  createSession(session: NewSession): Promise<void>;
  findSession(idHash: Buffer): Promise<StoredSession | null>;
  touchSession(idHash: Buffer, now: Date): Promise<void>;
  deleteSession(idHash: Buffer): Promise<void>;
}

export interface AuthServiceDeps {
  now: () => Date;
  today: () => string;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  dummyPasswordHash: string;
}

export interface LoginResult {
  token: string;
  user: User;
  expiresAt: Date;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUser(u: UserCredentials): User {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly deps: AuthServiceDeps,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(normalizeEmail(email));
    const valid = await this.deps.verifyPassword(
      user?.passwordHash ?? this.deps.dummyPasswordHash,
      password,
    );
    if (!user || !valid) throw new InvalidCredentialsError();

    const token = newSessionToken();
    const now = this.deps.now();
    const expiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);
    await this.repo.createSession({
      idHash: hashSessionToken(token),
      userId: user.id,
      now,
      expiresAt,
    });
    return { token, user: toUser(user), expiresAt };
  }

  async authenticate(token: string | undefined): Promise<User> {
    if (token === undefined || token === '') throw new UnauthenticatedError();
    const idHash = hashSessionToken(token);
    const session = await this.repo.findSession(idHash);
    if (!session) throw new UnauthenticatedError();

    const now = this.deps.now().getTime();
    const idleFor = now - session.lastSeenAt.getTime();
    if (idleFor >= IDLE_TIMEOUT_MS || now >= session.expiresAt.getTime()) {
      await this.repo.deleteSession(idHash);
      throw new UnauthenticatedError();
    }
    if (idleFor >= LAST_SEEN_WRITE_INTERVAL_MS) await this.repo.touchSession(idHash, new Date(now));
    return session.user;
  }

  sessionContext(user: User): { user: User; referenceDate: string } {
    return { user, referenceDate: this.deps.today() };
  }

  async logout(token: string): Promise<void> {
    await this.repo.deleteSession(hashSessionToken(token));
  }
}
