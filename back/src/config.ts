import { parseAppToday } from './modules/date.js';

export interface LoginRateLimit {
  perEmail: number;
  perIp: number;
  windowMs: number;
}

export interface Config {
  databaseUrl: string;
  port: number;
  trustedProxyIp: string | false;
  appToday: string | undefined;
  cookieSecure: boolean;
  loginRateLimit: LoginRateLimit;
  logLevel: string;
}

export function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`invalid ${name}: ${raw}`);
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`invalid ${name}: use true or false`);
}

export function loadConfig(): Config {
  const appToday = parseAppToday(process.env.APP_TODAY || undefined);
  return {
    databaseUrl: mustGetEnv('DATABASE_URL'),
    port: positiveInt('API_PORT', 3001),
    trustedProxyIp: process.env.TRUST_PROXY || false,
    appToday,
    cookieSecure: boolean('COOKIE_SECURE', false),
    loginRateLimit: {
      perEmail: positiveInt('LOGIN_RATE_LIMIT_PER_EMAIL', 5),
      perIp: positiveInt('LOGIN_RATE_LIMIT_PER_IP', 20),
      windowMs: positiveInt('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60_000),
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
