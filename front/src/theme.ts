// Sistema visual do portal (DECISOES_FUNDACAO §17): paleta e tipografia do EasyPay (Nickelfox, Figma Community,
// CC BY 4.0) adaptadas a um portal web. Toda a identidade visual mora aqui; os componentes só usam o tema.
import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Cores do arquivo do Figma (variáveis Gray/*, Neutral/*, Brand/*, Secondary/*).
export const palette = {
  ink: '#0B0A0A', // Gray/Black: a cor de ação (botões, item ativo do menu)
  cream: '#F9EFE5', // Brand/Primary Light: áreas de destaque
  background: '#F8F8F8', // Gray/Background: fundo das páginas
  border: '#E0E0E0', // Neutral/Gray 2
  textSecondary: '#595F67', // Gray/Gray 1: texto de apoio com contraste AA sobre branco
  // Acentos pastel, usados nos status (texto escuro por cima via autoContrast).
  yellow: '#FFF2CF',
  blue: '#BCE2FE',
  green: '#D6FFDC',
  pink: '#FCB3C5',
} as const;

// Escala do preto ao cinza-claro, montada a partir dos cinzas do Figma (do mais claro [0] ao mais escuro [9]).
const ink: MantineColorsTuple = [
  '#F2F2F2',
  '#E0E0E0',
  '#D0D3D8',
  '#AAAFB5',
  '#8F92A1',
  '#7F8790',
  '#595F67',
  '#3A3E44',
  '#1C1C1C',
  '#0B0A0A',
];

const cream: MantineColorsTuple = [
  '#FDF9F5',
  '#F9EFE5',
  '#F2E2D1',
  '#EAD3BC',
  '#E1C3A6',
  '#D8B491',
  '#C99B70',
  '#A87C52',
  '#7F5C3B',
  '#553D26',
];

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 9,
  colors: { ink, cream },
  // Texto escuro sobre fundos claros (badges pastel) e claro sobre escuros, calculado pelo Mantine.
  autoContrast: true,
  luminanceThreshold: 0.45,
  black: palette.ink,
  fontFamily: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"IBM Plex Sans", Roboto, system-ui, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'sm',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { fw: 500 } },
    Card: { defaultProps: { withBorder: true, radius: 'md', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'sm', variant: 'filled', fw: 600 } },
    NavLink: { defaultProps: { variant: 'filled', color: 'ink' } },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: 'sm' } },
  },
});
