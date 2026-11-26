import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Configuración base para todo el monorepo.
 * @param {string} tsconfigRootDir carpeta del paquete (import.meta.dirname)
 */
export function base(tsconfigRootDir) {
  return [
    {
      ignores: ['dist/**', '.next/**', 'coverage/**', 'cdk.out/**', '*.config.*', 'next-env.d.ts'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
        'no-console': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    prettier,
  ];
}
