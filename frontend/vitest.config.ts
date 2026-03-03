import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-reports/vitest.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',
    },
  },
})
