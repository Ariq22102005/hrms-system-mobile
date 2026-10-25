import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**', '.expo/**', 'test-results/**', 'playwright-report/**'] },
  { ...js.configs.recommended, files: ['**/*.js', '**/*.cjs', '**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', module: 'readonly', require: 'readonly', __dirname: 'readonly', Buffer: 'readonly', AbortSignal: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', fetch: 'readonly' } } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts', '**/*.tsx'] })),
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
  { files: ['src/screens/*.tsx'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
);
