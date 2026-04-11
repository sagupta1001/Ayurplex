import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement URL.createObjectURL/revokeObjectURL. maplibre-gl
// touches these at import time in a worker bootstrap, which surfaces as an
// unhandled rejection in test runs even though no test renders a map directly.
// Stub them globally so any accidental import stays quiet.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (): string => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = (): void => undefined;
}

afterEach(() => {
  cleanup();
});
