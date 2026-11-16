# Shuffleboard Shot Lab

Plain JavaScript, HTML, and CSS. There are no runtime dependencies or build step.
Serve the repository root with a static server, or open `index.html` directly.
Optional Google Fonts have local system-font fallbacks.

## Practice

Choose a Yellow/Black Tampa or St. Pete setup, select the shooting end, and tap the court to aim.
Target selection sets both direction and launch speed for an unobstructed shot under the current court
speed and drift. Collisions may change the outcome. Drag the queued shooter to adjust its starting point.

Each color has four biscuits total across the court, dead-biscuit collection area, queued shooter, and
supply. One alternating supply column shows the remaining shot order; only its top biscuit is available.
Drag it into a magnified view, or select it and tap to place. A valid placement advances the shooter.
Biscuits knocked off court or short
of the far dead line are collected behind the receiving kitchen and still count as used. Manually
dragging a biscuit off court returns it to supply. A drop is off court when its center is outside the
39 × 6 ft playing area. Overlapping placements are canceled. Canceling a drag restores its starting state.

The lock button in the scoring view prevents biscuit dragging there so a tap can place a target on an
existing biscuit. Unlock to rearrange biscuits. The full-court overview only moves the focus window.

The shooting-end view keeps the queued biscuit visible and overlays its opposite half with controls.
Use the central speed, aim, court-speed, and drift icons to open their exact settings. Block opens the
four practice setups. Pigeon places the current color randomly inside a 7 beside the kitchen line.
Lock, clockwise quarter-turn rotation, and Clear sit together above the focus view. Rotation changes
only that view; aiming and biscuit dragging use its rotated coordinates. The action row is Block,
Pigeon, Undo, Shoot, Replay, and outcome Prediction.

Undo restores the starting state of the last shot, including biscuits, shooter, aim, accuracy, and court
settings. Arrangement edits do not add Undo entries. Replay restores that starting state and immediately
shoots with fresh accuracy errors. Replay works after a completed shot or after Undo; it does not restore
an old sampled outcome. Clear court and practice setups reset shot history and preserve court settings.

## Outcome predictions and saved shots

Prediction explicitly simulates the queued shot without changing the live board or shot history.
It runs one trial when accuracy is 100% and no fast-shot penalty applies. Otherwise it runs 100 trials,
or 1,000 when the first 100 project a runtime below one second with scheduling headroom. Work yields
between short batches; closing the dialog cancels an unfinished run. Regenerate samples fresh outcomes.
Board, shooter, target, or non-accuracy shot/court changes discard active results until regenerated.

The court map overlays six-inch final-position footprints, with denser areas indicating more frequent
endpoints. Straight translucent lines connect each starting position to its final stopping/departure
position; they are displacement lines, not collision trajectories. Dashed labeled outlines mark starts. Toggle individual biscuits, either color,
or all biscuits; these visibility controls do not alter score probabilities. Collected-biscuit rates
appear separately. Switch between receiving-end and full-court views. The prediction dialog nearly fills the viewport,
with a larger court, compact 16px score rows, and native score-help and court-note tooltips.
Its header sits outside the scrolling content so mobile court content cannot scroll above it. Coordinates in results are physical
feet measured from Head, independent of viewport and shooting end.

The default table shows final Yellow and Black board scores, including previously placed biscuits.
Switch to per-player deltas to subtract the starting score from each color separately. The shooting
color’s column header is outlined in that color, and negative scoreboard totals are red. In delta
view, green marks changes that benefit the shooter and red marks changes that benefit the opponent.
Zero score cells display — in both table modes. The perfect
nominal shot (100% accuracy, fast-shot handicap disabled) defines the intended outcome. Its outlined
row stays first, including at 0% sampled likelihood; other rows descend by likelihood. Checking outcome rows filters the map to their combined trials. Multiple rows can be checked. If no trial matched the intended score, selecting it shows the nominal result with an
explicit zero-matches label. Show all outcomes clears the filter. Percentages use the complete run.
The scoreboard above the court shows the starting score; the lower scoreboard shows the selected
outcome; with multiple checked, it shows the most likely checked outcome. Without a selection it
shows the most likely overall outcome. Both scoreboards always show final totals.
Adjust Accuracy % in the dialog, then explicitly Regenerate. This updates the shared shot accuracy.
These are simulated estimates, not measured real-world odds.

Save up to 20 named predictions in this browser's localStorage. Suggested names compare the perfect
nominal end state with the starting board, recognizing kitchen shots, replacements, combinations via
another biscuit, clears, kitchen rescues, bump-ups, doubles, and scoring draws. They describe the
simulated intention rather than assuming the first biscuit touched is the target to clear. Names remain
editable. Saving opens a bottom drawer above predictions and selects the new shot name for immediate editing.
Saved shots is also available in the prediction header, at any scroll position. The drawer has its own
scroll area and native modal focus handling; Escape closes the drawer before closing predictions.
Saved shots support Load, Rename, and Delete. Load restores the starting arrangement, shooter, target,
accuracy, court settings, and stored results, and resets shot history. Close the dialog to shoot normally;
Regenerate produces fresh trials. Loading never silently rerandomizes a stored run. Older saves without
an intended result derive it from their stored starting state, preserving their existing names.

Full records smaller than 500 KiB retain each trial's sampled launch, final biscuit positions, collection
flags, scores, and actual stopping/departure coordinates. Larger runs retain score distributions and
per-biscuit endpoint counts on a 0.1-foot
grid, grouped by score outcome so map filtering still works. If browser storage rejects a write, the
library retries with compact summaries, including existing runs. It never evicts a saved shot. If that
also fails, the existing library remains intact and an error is shown. Browser quotas vary; no 20 MB
capacity is assumed. Saved shots are local to the browser and origin, and clearing site data removes them.

### Accuracy drafts and delivery playback

Editing prediction accuracy keeps the existing table and map visible. A light orange outline marks
Regenerate and the message “Results and accuracy are out of sync. Click to regenerate.” appears below
it. Regenerate commits that accuracy to the shot and replaces results only when the new run finishes.
Returning to the generated accuracy clears the warning. Save is disabled while accuracy is out of sync.
The draft survives closing/reopening the dialog; Close and Escape remain available during generation
and animation preparation. Non-accuracy board/shot changes still invalidate predictions.

Animate all shots replays the original sampled launches together on one clock at real-time speed.
It keeps the court view selected by the user throughout playback and stopping.
Multi-outcome filters and individual biscuit visibility still apply. Playback does not sample new errors or change
any saved outcome. Full saved runs can be animated; compact summaries need explicit regeneration.

Motion is prepared in short yielding batches with the same 1/240-second physics, stored temporarily
as 15 Hz Float32 frames, and interpolated for display. A 48 MiB preparation limit prevents runaway
memory use; no animation frames enter localStorage. Rendering can reduce to 30 fps if paint work exceeds
12 ms. In local 1,000-trial benchmarks preparation took about 0.5 s for three biscuits and 2 s for eight,
using approximately 4.7 and 12.2 MiB. A three-biscuit browser check averaged about 2.4 ms per draw.
Those are sample measurements on the development machine, not guaranteed device performance.

## Accuracy and court settings

One shared accuracy field controls aim and speed, defaults to 95.0%, and accepts 0.0–100.0% in 0.1 steps.
Speed error is uniform: `speed ± speed × (1 − accuracy / 100)`.
Aim has additive zero-mean Gaussian skill error: `sigmaSkill = 6° × (1 − accuracy / 100)`.
That scale is an illustrative simulator parameter, not a measured player rating or hit probability.

Fast shot inaccuracy defaults to enabled, with an 8.0 ft/s threshold adjustable in 0.1 steps.
Above the threshold an independent angular deviation grows linearly with actual sampled speed:
`sigmaSpeed = asin(0.5 / targetDistance) / 0.6744897501960817 × max(0, (speed − threshold) / 10)`.
The angle is converted to degrees and total spread is `hypot(sigmaSkill, sigmaSpeed)`.
With the default threshold, 100% accuracy at 18 ft/s has a calibrated 50% contact miss rate against an
unobstructed virtual six-inch biscuit. Changing the threshold shifts that reference speed by the same
amount. Disabling fast-shot inaccuracy removes only this speed penalty; skill and speed error still apply.

Starting position remains exact. Preview paths use nominal settings; firing samples actual launch values.
The miss estimate assumes no drift or intervening collisions and measures contact, not scoring probability.
Court slickness, drift, the fast-shot switch, and its threshold persist in localStorage. Unavailable or
malformed storage falls back to usable in-memory settings.

## Model

The model uses feet and seconds, six-inch equal-mass discs, a 39 × 6 ft playing area, nine-foot triangles,
18-inch kitchens, and 3/4-inch scoring borders. A biscuit must clear every border of a scoring cell to
score; the kitchen center separator is ignored. The far dead line is 25.5 ft from the shooting baseline.
Partial overhang remains in play during shots; a biscuit is out only once it completely passes an edge.
There are no cushion rebounds. Collected biscuits score zero and do not collide with live biscuits.

Slickness maps linearly to deceleration from 1.47 down to 0.12 ft/s². Collision restitution is 0.94.
Drift is uniform cross-court acceleration. Animation runs at 3× real time using a fixed 1/240-second
physics step and exact friction-only displacement. Spin, cue contact, variable friction, and environmental
effects are not modeled. This is an illustrative teaching model, not calibrated predictive software.

Head/Foot switching keeps existing biscuits at their physical court positions. The receiving view mirrors
as needed; full-court color sides remain fixed. Both vertical and horizontal mappings use the same scale
on both axes. Focus, shooting end, supply, and overview remain visible together on mobile and desktop.
The focus window spans the full court width; additional pinch/corner zoom is deferred.
In mobile landscape, shooting appears on the left and focus in the middle. Compact portrait layouts
reserve 20px for supply and 138px for the overview, with a 3px gap between areas.
Below 360px in portrait, the shooting panel spans the bottom row to keep its controls readable.

## Accessibility

Icon labels use native HTML hover tooltips through `title`, with accessible names through ARIA.
Clicking or focusing an icon does not open an application tooltip. Accuracy inputs retain an
accessible description, and the help icon has a native title explaining accuracy and preview paths.
The notes dialog has a programmatic heading, native modal focus handling, an autofocus close button,
Escape dismissal, and focus return to its trigger. Browser and assistive-technology verification remains
necessary before claiming complete WCAG conformance.

## Agent guidance

See [AGENTS.md](AGENTS.md) for coding and process conventions. The active refactor instructions,
clarifications, and reusable skills are in [agent/](agent/).

## Development

Use Node.js 22 or later. Run `npm ci` once to install pinned development tools.

- `npm test`: physics, accuracy distributions, interaction regressions, formatting, and predictions/storage.
- `npm run lint`: ESLint checks for browser code and Node scripts/tests.
- `npm run typecheck`: checks JavaScript and DOM types without emitting files.
- `npm run format`: formats sources, including the rule of threes.

JavaScript and CSS load directly. Refresh with the browser cache disabled if older assets persist.

### JavaScript

- `scripts/physics.js`: physics, geometry, scoring, and accuracy sampling; also usable in Node.
- `scripts/state.js`: shared state, typed DOM helpers, shot construction, snapshots, and court persistence.
- `scripts/simulation.js`: setups, totals, shot execution, and animation.
- `scripts/view.js`: readouts, canvas rendering, and court/screen coordinate conversion.
- `scripts/interactions.js`: shooting-end selection and pointer handling.
- `scripts/app.js`: control events, dialogs, pigeon placement, and startup.
- `scripts/supply.js`: alternating supply inventory, drag placement, and select-then-tap placement.
- `scripts/prediction-model.js`: isolated trials, score distributions, physical coordinates, and compact summaries.
- `scripts/prediction-storage.js`: validated, size-aware localStorage library with a 20-shot limit.
- `scripts/prediction-replay.js`: exact sampled-launch replay and compact in-memory motion frames.
- `scripts/prediction-animation.js`: batched preparation, synchronized playback, and cancellation.
- `scripts/prediction-ui.js`: generation, heat maps, filters, and saved-shot controls.
- `scripts/elements.d.ts`: DOM element types for JavaScript checking.

Classic browser scripts share a scope and load in the order listed in `index.html`, supporting direct
disk opening and letting tests exercise the same handlers.

### Stylesheets

- `style/app.css`: fonts, global tokens, resets, common elements, and workspace layout.
- `style/header.css`: branding, shooter selection, and persistent header actions.
- `style/controls.css`: setup, shot, and court controls.
- `style/court.css`: court views, captions, legends, supply biscuits, and lock control.
- `style/readouts.css`: scores, shot actions, and result text.
- `style/tooltips.css`: icon buttons and the accuracy-help trigger.
- `style/prediction.css`: prediction dialog, result tables, heat map, and saved-shot library.
- `style/dialogs.css`: modal notes, settings, practice setups, and backdrops.

Each area owns its responsive rules. Consolidate each selector within a media-query scope.
Use explicit state or context selectors for intentional overrides rather than duplicate rules
or source-order fixes. Load the stylesheets in the order listed in `index.html`.

## References

Practice concepts come from the [Clearwater Shuffleboard Club library](https://clearwatershuffleboard.com/learn/library/).
The in-app notes list individual authors and titles. Source books are not included.
Glen Peltier’s purchase-only booklet was unavailable for review.

The Gaussian motor-error form and speed–accuracy principle are research-informed:
[Zhang, Daw & Maloney (2013)](https://doi.org/10.1371/journal.pcbi.1003080),
[Zhang, Daw & Maloney (2015)](https://doi.org/10.1038/nn.4055), and
[Harris & Wolpert (1998)](https://doi.org/10.1038/29528).
These do not validate the simulator’s particular scales, thresholds, or calibration.
