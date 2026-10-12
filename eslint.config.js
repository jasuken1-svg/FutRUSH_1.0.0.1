import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        GM_xmlhttpRequest: 'readonly',
        unsafeWindow: 'readonly',
        __DEV__: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
