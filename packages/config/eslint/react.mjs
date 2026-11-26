import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { base } from './base.mjs';

export function react(tsconfigRootDir) {
  return [
    ...base(tsconfigRootDir),
    { languageOptions: { globals: { ...globals.browser } } },
    {
      plugins: { 'react-hooks': reactHooks },
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ];
}
