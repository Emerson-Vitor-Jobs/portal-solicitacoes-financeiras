import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import { resetFakeApi } from './fake-api';
import { server } from './msw';

const ASYNC_UTIL_TIMEOUT_MS = 5000;

configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element) => getComputedStyle(element);
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => resetFakeApi());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
