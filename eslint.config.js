import js from '@eslint/js'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

const webFiles = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}']

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/.next/',
    '**/out/',
    '**/dist/',
    '**/coverage/',
    '**/next-env.d.ts',
    'docs/design/',
  ]),
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // TypeScript (with checkJs) already reports undefined names; the core rule misreports Node globals.
      'no-undef': 'off',
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true },
      ],
    },
  },
  {
    // Application code logs through apps/api/src/log.ts or apps/web/src/diagnostics.
    files: ['apps/**', 'packages/**'],
    ignores: ['apps/api/src/log.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'stdout', message: 'Log through apps/api/src/log.ts.' },
        { object: 'process', property: 'stderr', message: 'Log through apps/api/src/log.ts.' },
      ],
    },
  },
  ...nextVitals.map((config) => ({ ...config, files: webFiles })),
  {
    files: webFiles,
    settings: { next: { rootDir: 'apps/web/' } },
  },
  prettier,
])
