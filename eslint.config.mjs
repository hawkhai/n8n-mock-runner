// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow `any` in a few controlled places (mock context casts)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Prefer const assertions over type-only imports where possible
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Disallow unused vars except those prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow require() only at top level (for require('../package.json'))
      '@typescript-eslint/no-require-imports': 'warn',
      // No floating promises
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    // Looser rules for test files
    files: ['tests/**/*.ts', '**/*.test.ts', 'fixtures/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
