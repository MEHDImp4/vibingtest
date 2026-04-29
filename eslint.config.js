import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Promise: 'readonly'
}

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  NodeJS: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly'
}

export default [
  {
    ignores: ['out/**', 'node_modules/**', 'dist/**', 'obsidian-brain/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'electron.vite.config.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'electron.vite.config.ts'],
    languageOptions: {
      globals: nodeGlobals
    }
  },
  {
    files: ['src/renderer/src/**/*.ts', 'src/renderer/src/**/*.tsx'],
    languageOptions: {
      globals: browserGlobals
    }
  }
]
