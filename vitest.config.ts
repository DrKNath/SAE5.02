import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/db/schema.ts'],
      // Seuil fixé dès le sprint 0 : la CI échoue en dessous.
      thresholds: {lines: 70, functions: 70, branches: 70, statements: 70},
    },
  },
});
