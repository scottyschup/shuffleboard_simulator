# Shuffleboard Shot Lab

Plain JavaScript, HTML and CSS. No package installation, framework, or build step.

Open `dist/index.html` in a browser, or serve the `dist` directory with any static web server.
An optional Google Fonts stylesheet has local system-font fallbacks.

## Use

Choose a practice setup, click the scoring-end view to aim, adjust launch speed and court slickness, then shoot. Clicking a target sets both direction and launch speed for an unobstructed shot, using current slickness and drift. Other biscuits can change the destination on contact. Higher slickness reduces friction while keeping launch speed unchanged.

There are open-court, clearing, St. Pete, Tampa, hit-and-roll, and kitchen setups. Optional uniform drift, path prediction, trails, color selection, starting-position adjustment, undo, and retry support practice. Free practice allows unlimited discs; match turns are not enforced.

`Space` shoots when focus is outside a control; arrow keys adjust aim by 0.05 degrees. Native sliders also support keyboard adjustment.

## Model

Feet and seconds; 6-inch equal-mass discs; 39 by 6 ft playing area; 9 ft triangles; 18-inch kitchens; 3/4-inch scoring borders. A disc must clear every cell border to score. The kitchen separator is ignored for scoring. Far dead line is 3 ft before the apex (25.5 ft from the shooting baseline). Short discs are removed at rest. Partial edge overhang remains in play; biscuits are removed only once completely past an edge, without rebound. The kitchen has angled outer borders.

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

## Arrangement and layout

In Setup, choose Yellow or Black, select Place on court, and tap either court view. Drag a stationary biscuit to move it, including to a partially overhanging position. Overlapping placements are prevented. Undo restores arrangement changes as well as shots. Every displaced biscuit has a predicted path and endpoint.

Desktop shows both court views within the viewport. Below 1000px, toggle Scoring end / Full court, use the Setup / Shot / Court control tabs, and Hide controls to expand the court. Browser checks cover a 390 × 844 mobile viewport and 1000 × 650 compact desktop viewport.

The scoring-end view includes the shufflegram and far dead line, using a single scale on both axes. Full-court orientation follows the available canvas shape. Geometry follows Eldridge, Shuffleboard Basics p.1, and Robertson, Making Your Hammer Count p.3: the 7 base is six feet wide, with kitchen sides inset above and flaring toward the baseline. Rendering and scoring share the same vertices.

Launch speed has ±0.05 ft/s buttons. The starting-position slider keeps both colors clear of the painted outer shooting-area lines, including the diagonal sides. The Guard color selector creates yellow or black St. Pete/Tampa setups and mirrors their shooting side. Aim supports ±20° to reach court targets from either starting area.
