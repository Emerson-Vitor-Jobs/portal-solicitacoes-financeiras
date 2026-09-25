import { createHash, randomBytes } from 'node:crypto';

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
