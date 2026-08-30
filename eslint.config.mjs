import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// 增量迁移期：仅对新架构 src/ 做 lint；旧代码（js/、components/、根入口）在 P4 清理后纳入
const legacyIgnores = [
  'dist/**',
  'node_modules/**',
  'public/**',
  'scripts/**',
  'tools/**',
  'js/**',
  'components/**',
  'workers/**',
  'tests/**/*.js',
  'app.js',
  'sw.js'
];

export default tseslint.config(
  { ignores: legacyIgnores },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser }
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }]
    }
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
);
