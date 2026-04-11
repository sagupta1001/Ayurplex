import type { Config } from 'tailwindcss';
import { theme } from '@ayurplex/ui/theme';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: theme.colors.primary,
        'leafy-green': theme.colors.leafyGreen,
        'dark-green': theme.colors.darkGreen,
        'secondary-blue': theme.colors.secondaryBlue,
        yellow: theme.colors.yellow,
        'dark-yellow': theme.colors.darkYellow,
        'dark-black': theme.colors.darkBlack,
        'mild-black': theme.colors.mildBlack,
        'dark-blue': theme.colors.darkBlue,
      },
      fontFamily: {
        heading: [theme.fonts.heading],
        body: [theme.fonts.body],
      },
      fontSize: {
        h1: theme.fontSizes.h1,
        h2: theme.fontSizes.h2,
        h3: theme.fontSizes.h3,
        h4: theme.fontSizes.h4,
        h5: theme.fontSizes.h5,
        'body-lg': theme.fontSizes.bodyLarge,
        'body-md': theme.fontSizes.bodyMedium,
        'body-base': theme.fontSizes.bodyNormal,
        'body-sm': theme.fontSizes.bodySmall,
      },
    },
  },
  plugins: [],
};

export default config;
