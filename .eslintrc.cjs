/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: [
    'dist',
    'functions',
    'scripts',
    '*.cjs',
    'vite.config.ts',
    '.eslintrc.cjs',
  ],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Pragmatic settings for an existing codebase: keep the high-signal rules
    // (rules-of-hooks is an error) without failing the build on the large
    // backlog of `any` usage and unused vars that predate this config.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': ['error', { checkLoops: false }],
  },
}
