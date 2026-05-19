// Minimal ESLint v9 flat config for @robin/desktop.
//
// The scaffolded `lint` script runs `eslint src --ext .ts,.tsx`, but the
// package was set up against ESLint 9 without a flat config file, so the CI
// `Lint` job failed at "no eslint.config found" before reaching any rule.
//
// v1 goal: lint is a green checkpoint that catches obvious bugs (unused vars,
// no-undef on rules typescript-eslint already disables for us). Real
// stylistic + react-hook rules land alongside the repo-wide flat-config
// migration in v2.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri/target', 'src-tauri/gen', 'design'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Loose: the codebase already typechecks via `tsc --noEmit`; we don't
      // want lint to block on stylistic preferences mid-scaffold.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': 'off',
    },
  },
);
