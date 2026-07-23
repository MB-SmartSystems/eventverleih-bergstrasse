import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Test setup for the mail template builders.
 *
 * Only the `@/` alias from tsconfig.json is mirrored here — the builders are pure
 * functions, so no DOM, no server runtime and no environment setup is needed.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
