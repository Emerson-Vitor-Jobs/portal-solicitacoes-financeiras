// Atalhos de requisição para os testes HTTP (app.inject), já com o header anti-CSRF nas escritas.
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { CSRF } from './server.js';

export const VALID_REQUEST = {
  supplier_name: 'Aurora Serviços Digitais',
  supplier_cnpj: '10.000.000/0001-45',
  invoice_number: 'NF-2026-9001',
  amount_cents: 155313,
  competence: '2026-09',
  due_date: '2026-09-30',
  category: 'SERVIÇOS',
  description: 'Teste de integração',
} as const;

export function http(app: FastifyInstance, cookie: string) {
  return {
    get: (url: string): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'GET', url, headers: { cookie } }),
    post: (url: string, payload: object): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'POST', url, headers: { cookie, ...CSRF }, payload }),
  };
}
