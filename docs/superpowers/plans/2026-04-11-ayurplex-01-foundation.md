# Ayurplex Plan 1 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a working pnpm + Turborepo monorepo with a Vite + React + TypeScript web app that renders a "Hello Ayurplex" screen styled with Priya's teal palette and Lexend/Roboto fonts, backed by a Supabase local dev config, with Vitest + Playwright + ESLint + Prettier all green in GitHub Actions CI.

**Architecture:** Monorepo with `apps/web` (React + Vite PWA shell), `packages/shared` (domain types), `packages/ui` (design tokens), and `supabase/` (local dev + migrations). Turborepo orchestrates `build`, `test`, `lint`, `typecheck`, `dev` across workspaces. No auth, no feature code, no native iOS/Android projects — those come in later plans.

**Tech Stack:** Node 20, pnpm 9, Turborepo, TypeScript 5 (strict), React 18, Vite 5, Tailwind CSS 3, Vitest, React Testing Library, Playwright, ESLint, Prettier, Supabase CLI, Capacitor 6 (config only), GitHub Actions.

---

## Context & References

- **Spec:** [`docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md`](../specs/2026-04-11-ayurplex-mvp-design.md)
- **Design tokens source:** Spec section "Design tokens (from Priya's Behance)"
- **Risk this plan primarily addresses:** R5 (timezone bugs) — we introduce `lib/date.ts` as the single wrapper, TDD-tested, so no raw `Date` is used elsewhere.
- **What is NOT in scope:** Auth, Google OAuth, medication/schedule/dose tables, RLS, Edge Functions, native iOS/Android Capacitor projects.

---

## Task 1: Initialize pnpm workspace, Turborepo, and base TypeScript config

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`
- Modify: `.gitignore`

- [ ] **Step 1: Pin Node version**

Create `.nvmrc`:

```
20
```

- [ ] **Step 2: Create workspace root `package.json`**

Create `package.json`:

```json
{
  "name": "ayurplex",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\""
  },
  "devDependencies": {
    "turbo": "^2.1.3",
    "typescript": "^5.6.2",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 3: Declare pnpm workspaces**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Configure Turborepo pipelines**

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".vite/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 5: Create strict shared TypeScript base config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "paths": {
      "@ayurplex/shared": ["./packages/shared/src/index.ts"],
      "@ayurplex/shared/*": ["./packages/shared/src/*"],
      "@ayurplex/ui": ["./packages/ui/src/index.ts"],
      "@ayurplex/ui/*": ["./packages/ui/src/*"]
    }
  }
}
```

- [ ] **Step 6: Extend `.gitignore` with monorepo artifacts**

Replace `.gitignore` contents with:

```
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
.turbo/
.vite/
*.tsbuildinfo

# Test output
coverage/
playwright-report/
test-results/

# Env files
.env
.env.local
.env.*.local

# Editor / OS
.DS_Store
.vscode/*
!.vscode/extensions.json
.idea/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
```

- [ ] **Step 7: Install dependencies at the workspace root**

Run:

```bash
pnpm install
```

Expected output (key success signal):

```
Scope: all 1 workspace project
Done in <time>
```

- [ ] **Step 8: Commit**

```bash
git add .nvmrc package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace + turborepo + ts base"
```

---

## Task 2: Scaffold `packages/shared` with domain type stubs (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/types.ts`, `packages/shared/src/types.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@ayurplex/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4 (RED): Write the failing type test**

Create `packages/shared/src/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { UserId } from './types';
import { makeUserId } from './types';

describe('UserId branded type', () => {
  it('constructs a UserId from a uuid string', () => {
    const id: UserId = makeUserId('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
    expect(typeof id).toBe('string');
    expect(id).toBe('3f4c1d84-2b0f-4c9a-8f5e-7b1b9e5b0a11');
  });
});
```

- [ ] **Step 5: Create barrel export (still failing because `types.ts` is missing)**

Create `packages/shared/src/index.ts`:

```ts
export * from './types';
```

- [ ] **Step 6: Install shared deps and run the failing test**

```bash
pnpm install
pnpm --filter @ayurplex/shared test
```

Expected: failure — `Cannot find module './types'` or similar. This confirms RED.

- [ ] **Step 7 (GREEN): Implement `types.ts`**

Create `packages/shared/src/types.ts`:

```ts
// Domain type stubs for Ayurplex. Expanded in later plans.
//
// We use branded primitive types (nominal typing) so IDs cannot be accidentally
// mixed (e.g. passing a MedicationId where a UserId is expected).

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;

export const makeUserId = (value: string): UserId => value as UserId;
```

- [ ] **Step 8: Run the test — expect GREEN**

```bash
pnpm --filter @ayurplex/shared test
```

Expected output:

```
 ✓ src/types.test.ts (1 test)
Test Files  1 passed (1)
     Tests  1 passed (1)
```

- [ ] **Step 9: Verify build passes**

```bash
pnpm --filter @ayurplex/shared build
```

Expected: no output and exit code 0.

- [ ] **Step 10: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): scaffold @ayurplex/shared with UserId branded type"
```

---

## Task 3: Scaffold `packages/ui` with Priya's design tokens

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`, `packages/ui/src/theme.ts`, `packages/ui/src/theme.test.ts`, `packages/ui/vitest.config.ts`

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@ayurplex/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./theme": "./src/theme.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4 (RED): Write the failing theme test**

Create `packages/ui/src/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme', () => {
  it('exposes Priya\'s primary forest green', () => {
    expect(theme.colors.primary).toBe('#007972');
  });

  it('exposes leafy green and dark green variants', () => {
    expect(theme.colors.leafyGreen).toBe('#19AFA2');
    expect(theme.colors.darkGreen).toBe('#4D9999');
  });

  it('exposes secondary blue', () => {
    expect(theme.colors.secondaryBlue).toBe('#27879F');
  });

  it('exposes yellow accents', () => {
    expect(theme.colors.yellow).toBe('#F9E169');
    expect(theme.colors.darkYellow).toBe('#D7BD37');
  });

  it('exposes neutrals', () => {
    expect(theme.colors.darkBlack).toBe('#111111');
    expect(theme.colors.mildBlack).toBe('#2C2C2C');
    expect(theme.colors.darkBlue).toBe('#092C4C');
  });

  it('uses Lexend for headings and Roboto for body', () => {
    expect(theme.fonts.heading).toContain('Lexend');
    expect(theme.fonts.body).toContain('Roboto');
  });

  it('defines Lexend heading sizes H1..H5', () => {
    expect(theme.fontSizes.h1).toBe('39px');
    expect(theme.fontSizes.h5).toBe('16px');
  });

  it('defines Roboto body sizes', () => {
    expect(theme.fontSizes.bodyLarge).toBe('31px');
    expect(theme.fontSizes.bodyMedium).toBe('20px');
    expect(theme.fontSizes.bodyNormal).toBe('16px');
    expect(theme.fontSizes.bodySmall).toBe('14px');
  });
});
```

- [ ] **Step 5: Create barrel export**

Create `packages/ui/src/index.ts`:

```ts
export { theme } from './theme';
export type { Theme } from './theme';
```

- [ ] **Step 6: Install and run test — expect RED**

```bash
pnpm install
pnpm --filter @ayurplex/ui test
```

Expected: failure — `Cannot find module './theme'`.

- [ ] **Step 7 (GREEN): Implement the theme**

Create `packages/ui/src/theme.ts`:

```ts
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
```

- [ ] **Step 8: Run test — expect GREEN**

```bash
pnpm --filter @ayurplex/ui test
```

Expected output:

```
 ✓ src/theme.test.ts (8 tests)
Test Files  1 passed (1)
     Tests  8 passed (8)
```

- [ ] **Step 9: Verify build**

```bash
pnpm --filter @ayurplex/ui build
```

Expected: exit code 0.

- [ ] **Step 10: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): add @ayurplex/ui with Priya's design tokens"
```

---

## Task 4: Scaffold `apps/web` with Vite + React + TypeScript

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/tsconfig.node.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/public/manifest.webmanifest`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@ayurplex/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint src --max-warnings 0"
  },
  "dependencies": {
    "@ayurplex/shared": "workspace:*",
    "@ayurplex/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@ayurplex/shared": ["../../packages/shared/src/index.ts"],
      "@ayurplex/shared/*": ["../../packages/shared/src/*"],
      "@ayurplex/ui": ["../../packages/ui/src/index.ts"],
      "@ayurplex/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["src/**/*", "vite.config.ts", "vitest.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `apps/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

- [ ] **Step 5: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#007972" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Ayurplex</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `apps/web/public/manifest.webmanifest`**

```json
{
  "name": "Ayurplex",
  "short_name": "Ayurplex",
  "description": "Smart adaptive medication reminders.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#007972",
  "icons": []
}
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 8: Create `apps/web/src/App.tsx` (initial placeholder — will be TDD'd in Task 6)**

```tsx
export function App(): JSX.Element {
  return (
    <main>
      <h1>Ayurplex</h1>
    </main>
  );
}
```

- [ ] **Step 9: Create `apps/web/src/index.css` (bare — Tailwind arrives in Task 5)**

```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');

body {
  margin: 0;
  font-family: 'Roboto', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 10: Install and build the web app**

```bash
pnpm install
pnpm --filter @ayurplex/web build
```

Expected output (key signal):

```
vite v5.x.x building for production...
✓ built in <time>
```

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Vite + React + TS app shell"
```

---

## Task 5: Add Tailwind CSS wired to `@ayurplex/ui` theme tokens

**Files:**
- Create: `apps/web/tailwind.config.ts`, `apps/web/postcss.config.cjs`
- Modify: `apps/web/package.json`, `apps/web/src/index.css`, `apps/web/src/App.tsx`

- [ ] **Step 1: Add Tailwind + PostCSS deps to the web app**

Update `apps/web/package.json` `devDependencies` by adding the following entries (keep existing entries intact):

```json
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13"
```

Resulting `devDependencies` block:

```json
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: `+ autoprefixer` / `+ postcss` / `+ tailwindcss` lines.

- [ ] **Step 3: Create `apps/web/postcss.config.cjs`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create `apps/web/tailwind.config.ts` that imports from `@ayurplex/ui`**

```ts
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
```

- [ ] **Step 5: Overwrite `apps/web/src/index.css` with Tailwind directives**

```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
  }

  h1,
  h2,
  h3,
  h4,
  h5 {
    font-family: 'Lexend', system-ui, -apple-system, sans-serif;
  }
}
```

- [ ] **Step 6: Update `apps/web/src/App.tsx` to use Tailwind primary token**

```tsx
export function App(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-primary text-white">
      <h1 className="font-heading text-h1">Ayurplex</h1>
    </main>
  );
}
```

- [ ] **Step 7: Verify build succeeds with Tailwind**

```bash
pnpm --filter @ayurplex/web build
```

Expected: `✓ built in <time>` with a CSS asset in the output listing.

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): wire Tailwind to @ayurplex/ui design tokens"
```

---

## Task 6: TDD — `App.test.tsx` with Vitest + React Testing Library

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`, `apps/web/src/App.test.tsx`
- Modify: `apps/web/package.json`, `apps/web/src/App.tsx`

- [ ] **Step 1: Add test deps to `apps/web/package.json` `devDependencies`**

Add these entries (keep existing):

```json
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@vitest/coverage-v8": "^2.1.1",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.1"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: new packages added.

- [ ] **Step 3: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: true,
  },
});
```

- [ ] **Step 4: Create `apps/web/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5 (RED): Write the failing `App.test.tsx`**

Create `apps/web/src/App.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('<App />', () => {
  it('renders the Hello Ayurplex greeting', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello Ayurplex');
  });
});
```

- [ ] **Step 6: Run tests — expect RED**

```bash
pnpm --filter @ayurplex/web test
```

Expected output (key failure):

```
FAIL  src/App.test.tsx > <App /> > renders the Hello Ayurplex greeting
  Expected element to have text content: Hello Ayurplex
  Received:                              Ayurplex
```

- [ ] **Step 7 (GREEN): Update `apps/web/src/App.tsx` to match the test**

```tsx
export function App(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-primary text-white">
      <h1 className="font-heading text-h1">Hello Ayurplex</h1>
    </main>
  );
}
```

- [ ] **Step 8: Run tests — expect GREEN**

```bash
pnpm --filter @ayurplex/web test
```

Expected output:

```
 ✓ src/App.test.tsx (1 test)
Test Files  1 passed (1)
     Tests  1 passed (1)
```

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "test(web): TDD Hello Ayurplex App component"
```

---

## Task 7: TDD — Timezone-aware `lib/date.ts`

This task addresses spec risk R5 (timezone bugs). All timestamps in Ayurplex are stored as UTC and must be rendered in the user's IANA timezone via this single wrapper. No raw `Date` math is allowed elsewhere.

**Files:**
- Create: `apps/web/src/lib/date.test.ts`, `apps/web/src/lib/date.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add date-fns deps to `apps/web/package.json` `dependencies`**

Add:

```json
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3 (RED): Write the failing tests**

Create `apps/web/src/lib/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toUserTimezone, formatTime, isWithinWindow } from './date';

describe('toUserTimezone', () => {
  it('converts a UTC ISO string to a zoned Date in America/Toronto', () => {
    // 2026-06-15T14:00:00Z = 10:00 EDT (UTC-4)
    const zoned = toUserTimezone('2026-06-15T14:00:00Z', 'America/Toronto');
    expect(zoned.getHours()).toBe(10);
    expect(zoned.getMinutes()).toBe(0);
  });

  it('handles DST fall-back transition (Toronto, 2026-11-01)', () => {
    // 2026-11-01T05:30:00Z = 01:30 EDT (before fall back)
    const zoned = toUserTimezone('2026-11-01T05:30:00Z', 'America/Toronto');
    expect(zoned.getHours()).toBe(1);
    expect(zoned.getMinutes()).toBe(30);
  });
});

describe('formatTime', () => {
  it('formats a UTC ISO string as 12h time in user tz', () => {
    expect(formatTime('2026-06-15T14:00:00Z', 'America/Toronto', '12h')).toBe('10:00 AM');
  });

  it('formats a UTC ISO string as 24h time in user tz', () => {
    expect(formatTime('2026-06-15T14:00:00Z', 'America/Toronto', '24h')).toBe('10:00');
  });
});

describe('isWithinWindow', () => {
  it('returns true when the UTC time falls inside the zoned window', () => {
    // 14:00 UTC = 10:00 EDT Toronto; window 08:00-11:00 local
    expect(
      isWithinWindow('2026-06-15T14:00:00Z', '08:00', '11:00', 'America/Toronto'),
    ).toBe(true);
  });

  it('returns false when the UTC time falls outside the zoned window', () => {
    // 14:00 UTC = 10:00 EDT Toronto; window 11:30-13:00 local → outside
    expect(
      isWithinWindow('2026-06-15T14:00:00Z', '11:30', '13:00', 'America/Toronto'),
    ).toBe(false);
  });

  it('handles a window that has already closed for the day', () => {
    // 23:00 UTC = 19:00 EDT; window 08:00-11:00 → outside
    expect(
      isWithinWindow('2026-06-15T23:00:00Z', '08:00', '11:00', 'America/Toronto'),
    ).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests — expect RED**

```bash
pnpm --filter @ayurplex/web test
```

Expected output (key failure):

```
FAIL  src/lib/date.test.ts
  Error: Failed to resolve import "./date"
```

- [ ] **Step 5 (GREEN): Implement `apps/web/src/lib/date.ts`**

```ts
// Timezone-aware date utilities. ALL date math in Ayurplex goes through this
// module — no raw `new Date()` arithmetic in feature code. Addresses spec R5
// (timezone bugs). Timestamps are stored as UTC in Supabase and converted to
// the user's IANA timezone (from `profiles.timezone`) at the edge.

import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export type TimeFormat = '12h' | '24h';

/**
 * Convert a UTC ISO string into a Date object whose local getters
 * (getHours, getMinutes, ...) read as wall-clock time in `timezone`.
 */
export function toUserTimezone(utcIso: string, timezone: string): Date {
  return toZonedTime(utcIso, timezone);
}

/**
 * Format a UTC ISO string as a wall-clock time string in the user's timezone.
 */
export function formatTime(utcIso: string, timezone: string, format: TimeFormat): string {
  const pattern = format === '12h' ? 'hh:mm a' : 'HH:mm';
  return formatInTimeZone(new Date(utcIso), timezone, pattern);
}

/**
 * Return true if the wall-clock time of `utcIso` in `timezone` falls within
 * the inclusive [startHHMM, endHHMM] window on the same local day.
 *
 * startHHMM / endHHMM are zero-padded 24h strings like "08:00" / "11:30".
 */
export function isWithinWindow(
  utcIso: string,
  startHHMM: string,
  endHHMM: string,
  timezone: string,
): boolean {
  const wallClock = formatInTimeZone(new Date(utcIso), timezone, 'HH:mm');
  return wallClock >= startHHMM && wallClock <= endHHMM;
}
```

- [ ] **Step 6: Run tests — expect GREEN**

```bash
pnpm --filter @ayurplex/web test
```

Expected output:

```
 ✓ src/App.test.tsx (1 test)
 ✓ src/lib/date.test.ts (7 tests)
Test Files  2 passed (2)
     Tests  8 passed (8)
```

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add timezone-aware lib/date.ts (R5)"
```

---

## Task 8: Create `lib/supabase.ts` client singleton (TDD)

**Files:**
- Create: `apps/web/src/lib/supabase.test.ts`, `apps/web/src/lib/supabase.ts`, `apps/web/.env.example`
- Modify: `apps/web/package.json`, `apps/web/src/vite-env.d.ts`

- [ ] **Step 1: Add `@supabase/supabase-js` to web `dependencies`**

Add:

```json
    "@supabase/supabase-js": "^2.45.4"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Create `apps/web/src/vite-env.d.ts` for typed env vars**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4 (RED): Write failing supabase client test**

Create `apps/web/src/lib/supabase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('supabase client singleton', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('exports a non-null supabase client built from env vars', async () => {
    const { supabase } = await import('./supabase');
    expect(supabase).not.toBeNull();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });

  it('throws if VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it('throws if VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/);
  });
});
```

- [ ] **Step 5: Run — expect RED**

```bash
pnpm --filter @ayurplex/web test
```

Expected: `Failed to resolve import "./supabase"`.

- [ ] **Step 6 (GREEN): Implement `apps/web/src/lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY');

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- [ ] **Step 7: Create `apps/web/.env.example`**

```
# Supabase local dev (matches supabase/config.toml)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=replace-with-output-of-`supabase status`
```

- [ ] **Step 8: Run tests — expect GREEN**

```bash
pnpm --filter @ayurplex/web test
```

Expected:

```
Test Files  3 passed (3)
     Tests  11 passed (11)
```

- [ ] **Step 9: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add supabase client singleton with env validation"
```

---

## Task 9: Create placeholder source directories with `.gitkeep`

**Files:**
- Create: `.gitkeep` in each route, feature, and top-level src subfolder.

- [ ] **Step 1: Create directories and `.gitkeep` files**

```bash
mkdir -p apps/web/src/routes/onboarding \
         apps/web/src/routes/home \
         apps/web/src/routes/calendar \
         apps/web/src/routes/add-med \
         apps/web/src/routes/adherence \
         apps/web/src/routes/settings \
         apps/web/src/features/medications \
         apps/web/src/features/schedules \
         apps/web/src/features/prescriptions \
         apps/web/src/features/calendar \
         apps/web/src/features/voice \
         apps/web/src/features/geofence \
         apps/web/src/components \
         apps/web/src/hooks \
         apps/web/src/stores \
         apps/web/src/types

touch apps/web/src/routes/onboarding/.gitkeep \
      apps/web/src/routes/home/.gitkeep \
      apps/web/src/routes/calendar/.gitkeep \
      apps/web/src/routes/add-med/.gitkeep \
      apps/web/src/routes/adherence/.gitkeep \
      apps/web/src/routes/settings/.gitkeep \
      apps/web/src/features/medications/.gitkeep \
      apps/web/src/features/schedules/.gitkeep \
      apps/web/src/features/prescriptions/.gitkeep \
      apps/web/src/features/calendar/.gitkeep \
      apps/web/src/features/voice/.gitkeep \
      apps/web/src/features/geofence/.gitkeep \
      apps/web/src/components/.gitkeep \
      apps/web/src/hooks/.gitkeep \
      apps/web/src/stores/.gitkeep \
      apps/web/src/types/.gitkeep
```

- [ ] **Step 2: Verify**

```bash
git status
```

Expected: all 16 `.gitkeep` files listed as untracked.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "chore(web): scaffold route + feature directories"
```

---

## Task 10: Add Capacitor config (no native projects generated)

**Files:**
- Create: `apps/web/capacitor.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add Capacitor deps to web `devDependencies`**

Add:

```json
    "@capacitor/cli": "^6.1.2",
    "@capacitor/core": "^6.1.2"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Create `apps/web/capacitor.config.ts`**

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ayurplex.app',
  appName: 'Ayurplex',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

- [ ] **Step 4: Verify config parses (no runtime action — just type-check)**

```bash
pnpm --filter @ayurplex/web typecheck
```

Expected: exit code 0.

> **Note:** This task intentionally does NOT run `npx cap add ios` or `npx cap add android`. Those generate `ios/` and `android/` native projects which require Xcode and Android Studio. We'll add them in a later plan when we actually need app store builds.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): add Capacitor config (no native projects yet)"
```

---

## Task 11: Initialize Supabase local dev config

**Files:**
- Create: `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Create `supabase/config.toml`**

```toml
# Ayurplex Supabase local dev config.
# Run `supabase start` (requires Supabase CLI + Docker) to launch.

project_id = "ayurplex-local"

[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://localhost:54321"

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
```

- [ ] **Step 2: Create `supabase/seed.sql`**

```sql
-- Ayurplex dev seed data.
-- Plan 1 leaves this empty. Later plans will populate test users, medications,
-- and scheduled doses per the spec's "Test data & seeding" section.
```

- [ ] **Step 3: Create `supabase/migrations/0001_init.sql`**

```sql
-- Migration 0001: enable required Postgres extensions.
--
-- Plan 1 ships an intentionally empty schema — just the extensions every
-- subsequent migration will rely on. Real tables (users, medications,
-- schedules, doses, prescriptions, calendar cache, RLS policies) land in
-- later plans.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
```

- [ ] **Step 4: Verify file tree**

```bash
ls supabase/ supabase/migrations/
```

Expected:

```
supabase/
config.toml  migrations  seed.sql
supabase/migrations/
0001_init.sql
```

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(supabase): add local dev config and 0001 extensions migration"
```

---

## Task 12: ESLint + Prettier with TypeScript strict rules

**Files:**
- Create: `.eslintrc.cjs`, `.prettierrc`, `.eslintignore`, `.prettierignore`
- Modify: root `package.json` (add lint devDeps), `apps/web/package.json` (lint script already present)

- [ ] **Step 1: Add lint/format devDeps to root `package.json`**

Update root `package.json` `devDependencies` (keep existing entries):

```json
  "devDependencies": {
    "turbo": "^2.1.3",
    "typescript": "^5.6.2",
    "prettier": "^3.3.3",
    "eslint": "^8.57.1",
    "@typescript-eslint/parser": "^8.8.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "eslint-plugin-react": "^7.37.1",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-config-prettier": "^9.1.0"
  }
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
node_modules
dist
build
.turbo
coverage
pnpm-lock.yaml
playwright-report
test-results
```

- [ ] **Step 5: Create `.eslintrc.cjs`**

```js
/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: { 'vitest-globals/env': true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'build', 'node_modules', '.turbo', 'coverage'],
};
```

- [ ] **Step 6: Create `.eslintignore`**

```
node_modules
dist
build
.turbo
coverage
pnpm-lock.yaml
playwright-report
test-results
*.config.cjs
```

- [ ] **Step 7: Run lint across the monorepo**

```bash
pnpm lint
```

Expected output (key success):

```
Tasks:    3 successful, 3 total
```

If lint errors appear in existing files, fix them to zero warnings before proceeding.

- [ ] **Step 8: Run formatter to normalize existing files**

```bash
pnpm format
```

- [ ] **Step 9: Commit**

```bash
git add .eslintrc.cjs .prettierrc .eslintignore .prettierignore package.json pnpm-lock.yaml apps packages
git commit -m "chore: add eslint + prettier config with strict TS rules"
```

---

## Task 13: Playwright smoke test for "Hello Ayurplex"

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add Playwright to web `devDependencies`**

Add:

```json
    "@playwright/test": "^1.48.0"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Install the Chromium browser binary (keeps CI fast)**

```bash
pnpm --filter @ayurplex/web exec playwright install chromium
```

Expected: `Chromium <version> downloaded`.

- [ ] **Step 4: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
```

- [ ] **Step 5: Create `apps/web/e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('landing page renders Hello Ayurplex', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello Ayurplex');
});
```

- [ ] **Step 6: Provide env vars so the Supabase client doesn't throw at boot**

Create `apps/web/.env.local` (NOT committed — listed in .gitignore):

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=placeholder-for-dev-smoke-test
```

- [ ] **Step 7: Run the E2E test**

```bash
pnpm --filter @ayurplex/web test:e2e
```

Expected output (key success):

```
Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/smoke.spec.ts:3:1 › landing page renders Hello Ayurplex (Xms)
  1 passed (Xs)
```

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "test(web): add Playwright smoke test for Hello Ayurplex"
```

---

## Task 14: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test-lint:
    name: Build / Test / Lint
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      VITE_SUPABASE_URL: http://localhost:54321
      VITE_SUPABASE_ANON_KEY: ci-placeholder-anon-key

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit + component tests
        run: pnpm test
```

> **Note:** Playwright E2E is intentionally not wired into CI in Plan 1. Once the app has more than a single smoke page (later plan), we'll add a dedicated `e2e` job that installs Chromium and runs against a preview build.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for build/test/lint"
```

---

## Task 15: README with dev quickstart

**Files:**
- Create (or overwrite): `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Ayurplex

Smart adaptive medication reminders. A React + Vite PWA (wrapped with Capacitor for iOS/Android) backed by Supabase. The scheduling engine is deterministic and rule-based — no LLM for safety-critical decisions.

> **Design source of truth:** [Priya Jaiswal's Ayurplex Behance project](https://www.behance.net/gallery/232160019/Ayurplex-Smart-AI-Medication-Reminders)
>
> **Spec:** [`docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md`](docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md)
>
> **Current state:** Plan 1 — Foundation. Monorepo skeleton only. No auth, no feature code yet.

## Prerequisites

- **Node.js 20** (see `.nvmrc`)
- **pnpm 9+** — `npm i -g pnpm`
- **Docker Desktop** — required by Supabase CLI local stack
- **Supabase CLI** — `brew install supabase/tap/supabase`

## Quickstart

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase URL + anon key after `supabase start`
pnpm --filter @ayurplex/web dev
```

Open http://localhost:5173 — you should see a "Hello Ayurplex" screen in Priya's forest green.

## Common tasks

```bash
pnpm build            # build all workspaces
pnpm test             # run Vitest unit + component tests
pnpm typecheck        # run tsc across the monorepo
pnpm lint             # ESLint, zero warnings allowed
pnpm format           # Prettier write

pnpm --filter @ayurplex/web test:e2e   # Playwright smoke test (requires dev server)
```

## Supabase local dev

```bash
supabase start        # launches Postgres (54322), API (54321), Studio (54323)
supabase status       # prints the anon key to paste into .env.local
supabase db reset     # re-applies migrations from supabase/migrations
supabase stop
```

## Project structure

```
ayurplex/
├── apps/
│   └── web/              # React + Vite PWA (the main client)
├── packages/
│   ├── shared/           # Shared domain types (grows with plans)
│   └── ui/               # Design tokens (Priya's palette + fonts)
├── supabase/
│   ├── config.toml
│   ├── migrations/       # Versioned SQL migrations
│   └── seed.sql
├── docs/
│   └── superpowers/
│       ├── specs/        # Design specifications
│       └── plans/        # Implementation plans (this plan lives here)
├── .github/workflows/    # CI
├── turbo.json
└── pnpm-workspace.yaml
```

## What's NOT in Plan 1

- Google OAuth / Supabase Auth wiring
- Medication / schedule / prescription tables and RLS policies
- Edge Functions (prescription parsing, reminder scheduling)
- Native iOS / Android Capacitor projects (generated in a later plan)

These land in subsequent plans — see `docs/superpowers/plans/`.

## License

Proprietary — all rights reserved (TBD for OSS release).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with dev quickstart"
```

---

## Task 16: Final verification — all gates green

**Files:** none (verification only).

- [ ] **Step 1: Clean install from lockfile**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo
pnpm install --frozen-lockfile
```

Expected: `Done in <time>` with no errors.

- [ ] **Step 2: Run the full CI gate locally**

```bash
pnpm build && pnpm typecheck && pnpm lint && pnpm test
```

Expected output (final lines):

```
Tasks:    X successful, X total
```

All four commands exit 0.

- [ ] **Step 3: Run the web E2E smoke test**

```bash
pnpm --filter @ayurplex/web test:e2e
```

Expected:

```
  1 passed (Xs)
```

- [ ] **Step 4: Manual visual check**

```bash
pnpm --filter @ayurplex/web dev
```

Open http://localhost:5173. Confirm visually:

- Background is forest green (`#007972`)
- Text reads "Hello Ayurplex"
- Heading is in Lexend (serif-less, slightly condensed)
- No console errors

Stop the dev server with Ctrl+C.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit --allow-empty -m "chore: complete Plan 1 foundation"
```

- [ ] **Step 6: Verify clean tree**

```bash
git status
```

Expected:

```
On branch main
nothing to commit, working tree clean
```

---

## Plan 1 acceptance criteria

At the end of this plan, all of the following must be true:

1. `pnpm install` succeeds from a clean clone.
2. `pnpm build` succeeds across all workspaces.
3. `pnpm typecheck` has zero errors.
4. `pnpm lint` has zero errors and zero warnings.
5. `pnpm test` runs Vitest suites in `packages/shared`, `packages/ui`, and `apps/web` — all green.
6. `pnpm --filter @ayurplex/web test:e2e` passes the Playwright smoke test.
7. `pnpm --filter @ayurplex/web dev` opens a browser at http://localhost:5173 showing "Hello Ayurplex" with Priya's forest-green primary color and Lexend heading font.
8. `supabase/migrations/0001_init.sql` applies cleanly via `supabase db reset` (manually verified — Supabase CLI runs outside CI for Plan 1).
9. GitHub Actions CI job is green on `main`.
10. Repo contains no TODOs, no placeholders, no `.env` files committed.

## What's deferred (handoff to future plans)

| Deferred item | Rationale | Planned plan |
|---|---|---|
| Google OAuth + Supabase Auth | Needs auth flow design | Plan 2 |
| `users`, `profiles`, `rooms` tables + RLS | Needs auth first | Plan 2 |
| `medications`, `medication_schedules` tables | After auth | Plan 3 |
| `scheduled_doses` + rule engine | After medications | Plan 4 |
| Edge Functions (`parse-prescription`, `schedule-reminders`, `refresh-calendar`, `dispatch-push`) | After schema | Plans 4–6 |
| Native iOS / Android Capacitor projects | Needs Xcode/Android Studio + signing | Plan 7 (pre-release) |
| Playwright E2E in CI | Needs more than one screen to test | Plan 3+ |
| `packages/shared/rule-engine` | Unit-tested in isolation | Plan 4 |

---

**End of Plan 1 — Foundation.**
