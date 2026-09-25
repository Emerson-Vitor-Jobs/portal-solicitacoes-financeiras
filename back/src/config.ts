// Configuração lida do ambiente. Variável obrigatória ausente derruba a subida (nada de default silencioso).
import { parseAppToday } from './modules/date.js';

export interface LoginRateLimit {
  perEmail: number;
  perIp: number;
  windowMs: number;
}

export interface Config {
  databaseUrl: string;
  port: number;
  // IP exato do nginx; só dele o X-Forwarded-For é confiável (DECISOES_FUNDACAO §14.6).
  trustProxy: string | false;
  // Data de referência fixa (YYYY-MM-DD). Ausente ou vazia → a data atual em America/Sao_Paulo (§9.4.1).
  appToday: string | undefined;
  // Flag `Secure` do cookie de sessão: false em http local, true em produção com HTTPS (§8.4).
  cookieSecure: boolean;
  loginRateLimit: LoginRateLimit;
  logLevel: string;
}

export function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} inválida: ${raw}`);
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} inválida: use true ou false`);
}

export function loadConfig(): Config {
  const appToday = parseAppToday(process.env.APP_TODAY || undefined);
  return {
    databaseUrl: mustGetEnv('DATABASE_URL'),
    port: positiveInt('API_PORT', 3001),
    trustProxy: process.env.TRUST_PROXY || false,
    appToday,
    cookieSecure: boolean('COOKIE_SECURE', false),
    // 5 tentativas por e-mail e 20 por IP a cada 15 min (§14.6), ajustáveis por env.
    loginRateLimit: {
      perEmail: positiveInt('LOGIN_RATE_LIMIT_PER_EMAIL', 5),
      perIp: positiveInt('LOGIN_RATE_LIMIT_PER_IP', 20),
      windowMs: positiveInt('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60_000),
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
