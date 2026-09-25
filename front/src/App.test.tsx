import { render, screen } from '@testing-library/react';
import { App } from './App';

// Smoke test do ferramental: jsdom + Mantine + Testing Library funcionando juntos.
test('renderiza o título do portal', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'Portal de Solicitações Financeiras' }),
  ).toBeInTheDocument();
});
