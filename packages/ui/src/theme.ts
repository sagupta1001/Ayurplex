// Design tokens lifted verbatim from Priya Jaiswal's Ayurplex Behance project.
// See docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md § Design tokens.

export const theme = {
  colors: {
    // Primary palette
    primary: '#007972',       // Forest Green
    leafyGreen: '#19AFA2',
    darkGreen: '#4D9999',
    secondaryBlue: '#27879F',

    // Accents
    yellow: '#F9E169',
    darkYellow: '#D7BD37',

    // Neutrals
    darkBlack: '#111111',
    mildBlack: '#2C2C2C',
    darkBlue: '#092C4C',
    white: '#FFFFFF',
    gray100: '#F5F5F5',
    gray200: '#E5E5E5',
    gray400: '#9CA3AF',
    gray600: '#4B5563',
  },
  fonts: {
    heading: "'Lexend', system-ui, -apple-system, sans-serif",
    body: "'Roboto', system-ui, -apple-system, sans-serif",
  },
  fontSizes: {
    // Lexend headings (H1 → H5)
    h1: '39px',
    h2: '31px',
    h3: '25px',
    h4: '20px',
    h5: '16px',
    // Roboto body
    bodyLarge: '31px',
    bodyMedium: '20px',
    bodyNormal: '16px',
    bodySmall: '14px',
  },
} as const;

export type Theme = typeof theme;
