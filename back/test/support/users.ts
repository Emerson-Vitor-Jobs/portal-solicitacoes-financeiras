import type { User } from '../../src/types/domain.js';

export const ANA: User & { password: string } = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Ana Solicitante',
  email: 'solicitante@gex.test',
  role: 'REQUESTER',
  password: 'GexRequester123!',
};

export const BRUNO: User & { password: string } = {
  id: '10000000-0000-4000-8000-000000000002',
  name: 'Bruno Solicitante',
  email: 'outro.solicitante@gex.test',
  role: 'REQUESTER',
  password: 'GexRequester456!',
};

export const FERNANDA: User & { password: string } = {
  id: '10000000-0000-4000-8000-000000000003',
  name: 'Fernanda Financeiro',
  email: 'financeiro@gex.test',
  role: 'FINANCE',
  password: 'GexFinance123!',
};

export const SEED_USERS = [ANA, BRUNO, FERNANDA];
