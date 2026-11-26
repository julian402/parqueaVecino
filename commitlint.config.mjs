// Conventional Commits + regla propia: ningún commit puede llevar Co-authored-by.
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-co-authors': ({ raw }) => [
          !/^co-authored-by:/im.test(raw ?? ''),
          'No se permite "Co-authored-by": el único autor es quien hace el commit.',
        ],
      },
    },
  ],
  rules: {
    'no-co-authors': [2, 'always'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'test',
        'docs',
        'chore',
        'ci',
        'build',
        'infra',
        'style',
        'revert',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
