import { setupServer } from 'msw/node';
import { handlers } from '../src/test/fake-api';

export const server = setupServer(...handlers);
