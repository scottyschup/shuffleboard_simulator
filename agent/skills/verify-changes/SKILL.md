---
name: verify-changes
description: Verify Shuffleboard Shot Lab changes with its formatter, lint/type checks, regression tests, and relevant UI checks before a phase handoff.
---

# Verify changes

Use the repository root. Read the [terminal-workaround skill](../terminal-workaround/SKILL.md) before
running commands; capture output in the ignored `tmp/` directory and inspect exit status and logs.

Inspect the working-tree diff first, including user edits. Choose checks that match the change:

- Run `npm run format`, `npm run lint`, and `npm run typecheck` for code changes. Formatting includes
  dependency-aware alphabetical ordering, the rule of threes, and logical section spacing.
- Run `npm test` after behavior changes, file moves, or changes that may affect shared browser scope.
  It covers physics, accuracy distributions, and real interaction handlers in a minimal DOM fixture.
- Run `git diff --check` before handing off changes. Check local asset paths after moving files.
- For CSS reorganization, confirm selector/media scope and effective declarations are preserved;
  preserve fallbacks and shorthand/longhand dependencies. Avoid duplicate selector rules.
- For UI changes, use the user's running app when available. Preserve their active board and settings
  when performing a non-destructive check. Verify changed controls, dismissal/focus behavior, and
  relevant responsive layouts. Do not describe DOM fixture tests as browser or screen-reader tests.

Fix failures and repeat affected checks. Once checks pass, repeat only for new changes or unresolved
concerns. Report what changed, which checks ran, and any actual verification gaps. Follow the requested
phase checkpoint; this skill does not grant permission to commit, publish, or advance scope.
