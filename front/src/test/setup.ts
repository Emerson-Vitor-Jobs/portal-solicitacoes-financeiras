// Setup recomendado pela documentação do Mantine para Vitest + jsdom.
import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import { resetFakeApi } from './fake-api';
import { server } from './msw';

// A primeira renderização de uma tela com Mantine pode passar de 1 s em máquina carregada (ou no
// container de teste); 1 s é o padrão do findBy/waitFor.
configure({ asyncUtilTimeout: 5000 });

const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (elt) => getComputedStyle(elt);
window.HTMLElement.prototype.scrollIntoView = () => {};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// API mockada com MSW (a API real responde 501 durante o desenvolvimento do front). Qualquer
// chamada sem handler falha o teste, em vez de passar em silêncio.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => resetFakeApi());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
