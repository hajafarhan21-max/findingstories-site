import js from '@eslint/js';

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', crypto: 'readonly', document: 'readonly', window: 'readonly', location: 'readonly', FormData: 'readonly', sessionStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } }
  }
];
