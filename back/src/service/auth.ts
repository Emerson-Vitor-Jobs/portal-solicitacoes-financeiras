// Login, sessão e logout (DECISOES_FUNDACAO §5.2, §8). Regra pura: a persistência entra pela porta AuthRepository.
import { hashSessionToken, newSessionToken } from '../modules/session_token.js';
import type { User } from '../types/domain.js';
import { InvalidCredentialsError, UnauthenticatedError } from './errors.js';

// Limites superiores da faixa da OWASP para baixo risco (§8.2).
export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
// `last_seen_at` é gravado no máximo uma vez por minuto, pra não escrever no banco a cada request.
export const TOUCH_INTERVAL_MS = 60_000;

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

// Porta de saída: o que o service precisa da persistência (o consumidor define a interface).
export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserCredentials | null>;
  createSession(session: NewSession): Promise<void>;
  findSession(idHash: Buffer): Promise<StoredSession | null>;
  touchSession(idHash: Buffer, now: Date): Promise<void>;
  deleteSession(idHash: Buffer): Promise<void>;
}

export interface AuthServiceDeps {
  now: () => Date;
  // A data de referência do servidor (APP_TODAY ou hoje em SP), devolvida no contexto da sessão (§14.2).
  today: () => string;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  // Hash argon2 de uma senha aleatória, calculado na subida. Usuário inexistente é verificado contra ele,
  // e os dois caminhos do login levam o mesmo tempo (anti-enumeração por timing, §5.2).
  dummyPasswordHash: string;
}

export interface LoginResult {
  token: string;
  user: User;
  expiresAt: Date;
}

// Mesma forma canônica da coluna users.email (minúsculo, sem espaço). Também é a chave do rate limit por e-mail.
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

  // Usuário inexistente e senha errada: mesma verificação argon2, mesmo erro (§5.2).
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(normalizeEmail(email));
    const valid = await this.deps.verifyPassword(
      user?.passwordHash ?? this.deps.dummyPasswordHash,
      password,
    );
    if (!user || !valid) throw new InvalidCredentialsError();

    // Sessão nova a cada login: evita session fixation (§8.1).
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

  // Resolve o token do cookie para o usuário, com o papel ATUAL do banco (§8.1).
  async authenticate(token: string | undefined): Promise<User> {
    if (token === undefined || token === '') throw new UnauthenticatedError();
    const idHash = hashSessionToken(token);
    const session = await this.repo.findSession(idHash);
    if (!session) throw new UnauthenticatedError();

    const now = this.deps.now().getTime();
    const idleFor = now - session.lastSeenAt.getTime();
    if (idleFor >= IDLE_TIMEOUT_MS || now >= session.expiresAt.getTime()) {
      // Sessão expirada encontrada numa busca é apagada ali mesmo (sem cron).
      await this.repo.deleteSession(idHash);
      throw new UnauthenticatedError();
    }
    if (idleFor >= TOUCH_INTERVAL_MS) await this.repo.touchSession(idHash, new Date(now));
    return session.user;
  }

  // Quem está logado + o "hoje" do servidor: o front nunca usa o relógio do navegador para regra de data.
  sessionContext(user: User): { user: User; referenceDate: string } {
    return { user, referenceDate: this.deps.today() };
  }

  async logout(token: string): Promise<void> {
    await this.repo.deleteSession(hashSessionToken(token));
  }
}
