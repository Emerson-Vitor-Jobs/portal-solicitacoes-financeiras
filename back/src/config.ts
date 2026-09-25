// Configuração lida do ambiente. Variável obrigatória ausente derruba a subida (nada de default silencioso).

export interface Config {
  databaseUrl: string;
  port: number;
  // IP exato do nginx; só dele o X-Forwarded-For é confiável (DECISOES_FUNDACAO §14.6).
  trustProxy: string | false;
}

export function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  const port = Number(process.env.API_PORT ?? '3001');
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`API_PORT inválida: ${process.env.API_PORT}`);
  }
  return {
    databaseUrl: mustGetEnv('DATABASE_URL'),
    port,
    trustProxy: process.env.TRUST_PROXY || false,
  };
}
