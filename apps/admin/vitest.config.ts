import { defineConfig } from 'vitest/config';

// Component and logic tests for the staff console. The pages are Next.js client components, so they run in jsdom
// with the API module and the router replaced by small fakes inside each test.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
  },
});
