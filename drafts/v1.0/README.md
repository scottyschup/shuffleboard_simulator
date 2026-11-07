# Shuffleboard Shot Lab

Plain JavaScript, HTML and CSS. No package installation, framework, or build step.

Open `dist/index.html` in a browser, or serve the `dist` directory with any static web server.
An optional Google Fonts stylesheet has local system-font fallbacks.

## Use

Choose a practice setup, click the scoring-end view to aim, adjust launch speed and court slickness, then shoot. The aim point controls direction; it does not set stopping distance. Higher slickness reduces friction while keeping launch speed unchanged.

There are open-court, clearing, St. Pete, Tampa, hit-and-roll, and kitchen setups. Optional uniform drift, path prediction, trails, color selection, starting-position adjustment, undo, and retry support practice. Free practice allows unlimited discs; match turns are not enforced.

`Space` shoots when focus is outside a control; arrow keys adjust aim by 0.05 degrees. Native sliders also support keyboard adjustment.

## Model

Feet and seconds; 6-inch equal-mass discs; 39 by 6 ft playing area; 9 ft triangles; 18-inch kitchens; 3/4-inch scoring borders. A disc must clear every cell border to score. The kitchen separator is ignored for scoring. Far dead line is 3 ft before the apex (25.5 ft from the shooting baseline). Short discs are removed at rest; gutters and the far baseline remove discs without rebound.

Slickness maps linearly to deceleration from 1.47 down to 0.12 ft/s². Restitution is 0.94. Drift is an optional small uniform cross-court acceleration, not a measured surface map. No spin, cue contact, variable disc friction, or environmental effects. Animation runs at 3x real time. Physical integration uses a fixed 1/240-second step, exact friction-only displacement, and equal-mass collision impulses. This is an illustrative teaching model, not calibrated predictive software.

## Reading

Source library: https://clearwatershuffleboard.com/learn/library/

Reviewed material includes shot and strategy guidance from Mary Eldridge, Bill Boyes, Floyd Swem, P. C. Bullard, Earl Ball, Bob Zaletel, and Thom Robertson. See the in-app notes for the individual titles and the model's limitations. Glen Peltier's booklet is purchase-only on this page and was unavailable. Source books remain with their copyright holders and are not included in this project. Physics constants are our modeling choices, not values established by these authors.

## Verification

With Node.js installed, run `node tests/physics.cjs` to check analytic stopping distance, scoring-cell boundaries, the kitchen separator exception, collision momentum, glancing contacts, slickness, and drift. Browser QA checked an open-court 8, slickness changes, collision practice, undo/retry, and source notes.

## Files

- `dist/index.html`: interface and source/model notes
- `dist/style.css`: responsive styling
- `dist/physics.js`: deterministic physics and scoring
- `dist/app.js`: canvas views and interaction
- `tests/physics.cjs`: numerical checks
