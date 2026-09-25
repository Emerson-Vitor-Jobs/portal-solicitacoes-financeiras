import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

export const palette = {
  ink: '#0B0A0A',
  cream: '#F9EFE5',
  background: '#F8F8F8',
  textSecondary: '#595F67',
  danger: '#B42318',
  yellow: '#FFF2CF',
  blue: '#BCE2FE',
  green: '#D6FFDC',
  pink: '#FCB3C5',
  lavender: '#D6E1FF',
} as const;

export const avatarColors = [
  palette.yellow,
  palette.blue,
  palette.green,
  palette.pink,
  palette.lavender,
] as const;

const inkScale: MantineColorsTuple = [
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

const creamScale: MantineColorsTuple = [
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

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--app-color-ink': palette.ink,
    '--app-color-highlight': palette.yellow,
    '--app-brutal-border': `2px solid ${palette.ink}`,
    '--app-brutal-shadow': `4px 4px 0 ${palette.ink}`,
    '--app-brutal-shadow-small': `2px 2px 0 ${palette.ink}`,
    '--app-brutal-radius': '12px',
    '--app-brutal-radius-small': '10px',
  },
  light: {},
  dark: {},
});

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 9,
  colors: { ink: inkScale, cream: creamScale },
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
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: 'sm' } },
  },
});
