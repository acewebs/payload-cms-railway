import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: ['.next/', 'node_modules/', 'src/payload-types.ts', 'src/app/(payload)/**', 'src/migrations/**'],
  },
]

export default eslintConfig
