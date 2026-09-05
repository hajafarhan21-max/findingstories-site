import js from '@eslint/js';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'public/project-source-upload-client.js'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', crypto: 'readonly', document: 'readonly', window: 'readonly', location: 'readonly', FormData: 'readonly', FileReader: 'readonly', sessionStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } }
  }
];
