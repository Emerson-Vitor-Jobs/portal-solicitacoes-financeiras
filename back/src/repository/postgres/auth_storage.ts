// Adaptador da porta AuthRepository (service/auth.ts) sobre as queries geradas pelo PgTyped.
import type pg from 'pg';
import type {
  AuthRepository,
  NewSession,
  StoredSession,
  UserCredentials,
} from '../../service/auth.js';
import { toRole } from './map.js';
import {
  deleteSession,
  findSessionWithUser,
  insertSession,
  touchSession,
  type IFindSessionWithUserResult,
} from './queries/sessions.queries.js';
import { findUserByEmail, type IFindUserByEmailResult } from './queries/users.queries.js';

function mapCredentials(row: IFindUserByEmailResult): UserCredentials {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: toRole(row.role),
    passwordHash: row.password_hash,
  };
}

function mapSession(row: IFindSessionWithUserResult): StoredSession {
  return {
    user: { id: row.id, name: row.name, email: row.email, role: toRole(row.role) },
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  };
}

export class AuthStorage implements AuthRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findUserByEmail(email: string): Promise<UserCredentials | null> {
    const [row] = await findUserByEmail.run({ email }, this.pool);
    return row ? mapCredentials(row) : null;
  }

  async createSession(session: NewSession): Promise<void> {
    await insertSession.run(
      {
        idHash: session.idHash,
        userId: session.userId,
        now: session.now,
        expiresAt: session.expiresAt,
      },
      this.pool,
    );
  }

  async findSession(idHash: Buffer): Promise<StoredSession | null> {
    const [row] = await findSessionWithUser.run({ idHash }, this.pool);
    return row ? mapSession(row) : null;
  }

  async touchSession(idHash: Buffer, now: Date): Promise<void> {
    await touchSession.run({ idHash, now }, this.pool);
  }

  async deleteSession(idHash: Buffer): Promise<void> {
    await deleteSession.run({ idHash }, this.pool);
  }
}
