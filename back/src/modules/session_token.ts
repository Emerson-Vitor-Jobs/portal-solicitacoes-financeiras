// Token de sessão opaco (DECISOES_FUNDACAO §8.1): 32 bytes aleatórios (256 bits) vão no cookie em base64url;
// o banco guarda só o SHA-256 deles. Um vazamento da tabela não permite sequestrar sessões.
import { createHash, randomBytes } from 'node:crypto';

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
