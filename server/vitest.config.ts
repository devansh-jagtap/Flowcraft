import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // A fixed secret so account API keys can be encrypted in tests.
    env: { NODE_ENV: 'test', AI_KEYS_SECRET: 'test-only-secret-for-encrypting-user-api-keys' },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
