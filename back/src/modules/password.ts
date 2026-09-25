import { hash, verify } from '@node-rs/argon2';

// argon2id com o mínimo recomendado pela OWASP: m = 19 MiB, t = 2, p = 1 (DECISOES_FUNDACAO §8.5).
// `algorithm: 2` = Argon2id. O pacote exporta um `const enum`, que não pode ser importado com isolatedModules.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
