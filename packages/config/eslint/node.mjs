import globals from 'globals';
import { base } from './base.mjs';

export function node(tsconfigRootDir) {
  return [
    ...base(tsconfigRootDir),
    { languageOptions: { globals: { ...globals.node } } },
    {
      // NestJS usa clases con decoradores e inyección: estas reglas dan falsos positivos.
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/no-extraneous-class': 'off',
      },
    },
  ];
}
