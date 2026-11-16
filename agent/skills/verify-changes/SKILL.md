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

For prediction changes, also check deterministic shots with the fast-shot penalty off and variable
shots with it on, including 100% accuracy above the threshold. Verify that generation leaves the live
board unchanged, score rows filter matching trials, and individual/color visibility does not change
score frequencies. Exercise saved full and compact runs, the 20-save cap, rename followed by Load,
quota failures, and invalidation after board/settings changes. Check the prediction dialog in portrait
and landscape, using both shooting ends and receiving/full-court views. Verify intended-first ordering,
including an unobserved intention, final totals versus per-player deltas, selected/most-likely after
scores, accuracy drafts and sync warnings, combination-shot naming, and save-to-name scroll/focus. Verify
Close/Escape while accuracy is dirty and during animation preparation; replay sampled launches without
rerandomizing, check negative score colors and shooter header outlines, and measure frame costs for
large runs. Test multi-outcome checkbox unions, both shooter colors for delta signs, zero-score dashes,
and animation view preservation. Check the bottom drawer’s close/focus and underlying scroll behavior;
verify the mobile header does not move when deep table controls receive focus. Refresh seeded browser
fixtures after changing HTML or script loading order.

Fix failures and repeat affected checks. Once checks pass, repeat only for new changes or unresolved
concerns. Report what changed, which checks ran, and any actual verification gaps. Follow the requested
phase checkpoint; this skill does not grant permission to commit, publish, or advance scope.
