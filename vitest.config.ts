import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for every layer below the UI (infrastructure, repositories, services, composables, utils, types).
// Standalone on purpose: the Vue/Vuetify plugins from vite.config.ts aren't needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Every test starts with fresh mocks (no calls, no return values left over);
    // spies created with vi.spyOn are restored.
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/infrastructure/**/*.ts',
        'src/repositories/**/*.ts',
        'src/services/**/*.ts',
        'src/composables/**/*.ts',
        'src/utils/**/*.ts',
        'src/types/**/*.ts',
        'src/i18n/**/*.ts',
      ],
      exclude: ['test/**'],
      reporter: ['text', 'lcov'],
      // CI gate: every line, branch, function and statement must be covered.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
})
