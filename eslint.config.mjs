import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'styles.css',
      'docs/**',
      '.gemini/**',
      'icons/**'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        SUPABASE_CONFIG: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'eqeqeq': ['error', 'smart']
    }
  },
  {
    files: ['sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker
      }
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^API_HOST$' }]
    }
  },
  {
    files: ['data/config.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['scripts/**/*.js', 'tailwind.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
