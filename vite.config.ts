import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: pages ? '/MoneyRes/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
