# Shuffleboard Shot Lab

Plain JavaScript, HTML, and CSS. There are no runtime dependencies or build step.
Serve the repository root with a static server, or open `index.html` directly.
Optional Google Fonts have local system-font fallbacks.

## Practice

Choose a Yellow/Black Tampa or St. Pete setup, select the shooting end, and tap or drag on the court to aim.
Target selection sets both direction and launch speed for an unobstructed shot under the current court
speed and drift. Collisions may change the outcome. Drag the queued shooter to adjust its starting point.

Each color has four biscuits total across the court, dead-biscuit collection area, queued shooter, and
supply. One supply column alternates colors as the remaining inventory allows. Any queued biscuit can be dragged
into a magnified view, or selected and tapped to place. Equal queued counts preserve the shooter. Pulling
the shooter’s color when it has more queued biscuits than the opponent switches the shooting color.
Biscuits knocked off court or short
of the far dead line are collected behind the receiving kitchen and still count as used. Manually
dragging a biscuit off court moves it into collection. Drop it onto the queue between the courts
to return it to supply, alternating the remaining colors as inventory permits. Dragging a court
or queued biscuit into the collection strip parks it as used, excluded from collisions and scoring;
collected biscuits can be dragged back onto the court. A drop is off court when its center is outside the
39 × 6 ft playing area. Overlapping placements are canceled. Canceling a drag restores its starting state.

The lock button in the scoring view prevents biscuit dragging there so a tap can place a target on an
existing biscuit. Unlock to rearrange biscuits. The full-court overview only moves the focus window.

The shooting-end canvas keeps its original proportions and control sizing. The panel shifts left into
unused space to clear launch positions. Four stacked adjustment rows retain decrease/icon/increase
order, with values centered in the extra space to the right. Middle icons are labels with native hover
tooltips. Accuracy remains in the compact footer strip. The gear button opens exact shot/court settings. Block adds only the selected Tampa/St. Pete biscuit, preserving the board, shooter, aim, and shot history.
Occupied positions or exhausted inventory are rejected without altering the board. Yellow
and Black pigeon buttons place their own color randomly inside a 7 beside the kitchen line, without
changing the shooter and while reserving the queued shooter’s biscuit.
Lock, clockwise quarter-turn rotation, and Clear sit together above the focus view. Rotation changes
only that view; aiming and biscuit dragging use its rotated coordinates. The action row is Block,
Yellow Pigeon, Black Pigeon, Undo, Shoot, Replay, and outcome Prediction.

Undo restores the starting state of the last shot, including biscuits, shooter, aim, accuracy, and court
settings. Arrangement edits do not add Undo entries. Replay restores that starting state and immediately
shoots with fresh accuracy errors. Replay works after a completed shot or after Undo; it does not restore
an old sampled outcome. Clear court resets shot history and preserves court settings. Adding a block preserves shot history.

## Outcome predictions and saved shots

Prediction explicitly simulates the queued shot without changing the live board or shot history.
It runs one trial when accuracy is 100% and no fast-shot penalty applies. Otherwise it runs 100 trials,
or 1,000 when the first 100 project a runtime below one second with scheduling headroom. Work yields
between short batches; closing the dialog cancels an unfinished run. Regenerate samples fresh outcomes.
Board, shooter, target, or non-accuracy shot/court changes discard active results until regenerated.

The map shows trial positions and actual routes through collisions and drift with twice the original density-scaled opacity per trial: `min(1, 2 × max(1/255, 1 − exp(−12 × count / selectedTrials)))`.
Dashed labeled outlines mark starts. Opaque intended final positions and short dotted paths show the
perfect shot independently of the selected trials. Individual, color, and all-biscuit visibility
controls affect drawing only, never score probabilities. Collection rates and map notes are in the
court tooltip. The unlabeled collection strip is 1.5 biscuit diameters deep and collected biscuits do
not participate in physics. Receiving/full-court and final/delta views use labeled button pairs. The full-court
map fills its available width in landscape or height in portrait without changing court proportions.
The prediction dialog nearly fills the viewport with compact 16px score rows. Its header sits outside
the scrolling content. Results use physical feet from Head, independent of viewport and shooting end.

The table defaults to Delta Score, subtracting each color’s starting score. Final Score shows final
Yellow and Black totals including previously placed biscuits. Both modes include a Delta column showing the score-change
advantage: Black −10 and Yellow +7 becomes Yellow +17. The shooter’s entire column is outlined in its
color, with an italic shooting label above the table; the perfect nominal outcome (100% accuracy and no fast-shot handicap)
is pinned first with a #55a080 outline that takes precedence where outlines cross. Other rows descend
by likelihood. In both table views, positive score values are bold green and negative values are bold red; zero
score cells display —, and percentages remain neutral. Negative scoreboard totals remain red.

All sampled outcomes start selected. Scenario buttons select Yellow/Black score increases/decreases
or self-kitchen (the delivered biscuit finishes in the kitchen). Use table checkboxes to add or remove
score groups; a mixed checkbox means a scenario selected only part of that score group. Scenarios
use trial-level results, so identical board totals can have different self-kitchen status. Selected
Outcome % shows the probability of the selected union against the complete run; its label becomes a
tooltip on mobile. No selection means 0%; Show all outcomes restores 100%. The upper scoreboard shows
the starting score; the lower scoreboard shows the most likely selected result, or the intention
when no sampled trials are selected. Both scoreboards show final totals. The intended positions and
route remain visible even when no sampled trial matched them.
Adjust Accuracy % in the dialog, then explicitly Regenerate. This updates the shared shot accuracy.
These are simulated estimates, not measured real-world odds.

Save up to 25 named predictions in this browser's localStorage. Suggested names compare the perfect
nominal end state with the starting board, recognizing kitchen shots, replacements, combinations via
another biscuit, clears, kitchen rescues, bump-ups, doubles, and scoring draws. They describe the
simulated intention rather than assuming the first biscuit touched is the target to clear. Names remain
editable. Saving opens a bottom drawer above predictions and selects the new shot name for immediate editing.
Saved shots is also available in the prediction header, at any scroll position. The drawer has its own
scroll area and native modal focus handling; Escape closes the drawer before closing predictions.
Saved shots support 🔮 Load, inline ✏️ editing, red 🗑️ Delete, and Export. Load restores the starting arrangement, shooter, target,
accuracy, court settings, and stored results, and resets shot history. Close the dialog to shoot normally;
Regenerate produces fresh trials. Loading never silently rerandomizes a stored run. Older saves without
an intended result derive it from their stored starting state, preserving their existing names.

Full records smaller than 500 KiB retain each trial's sampled launch, final biscuit positions, collection
flags, scores, actual stopping/departure coordinates, and simplified timed routes. Larger runs retain score distributions and
per-biscuit endpoint counts on a 0.1-foot
grid, with route coordinates rounded to 0.01 feet and groups split by score and self-kitchen status.
Older full saves reconstruct routes from their sampled launches. Older compact saves need explicit
regeneration for routes and self-kitchen filtering because they did not retain that information. If browser storage rejects a write, the
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

Replay reads the original sampled launches on one shared clock. The digital stopwatch shows seconds
and milliseconds. Turtle/Play/Pause/Rabbit buttons adjust speed from 0.25× to 4×, resume, or hold the
current frame. After preparation, the timeline slider seeks backward and forward without sampling new
errors. Reaching the end leaves the final frame visible; Play restarts it. Closing the modal cancels
preparation/playback. The selected court view, zoom, and pan remain unchanged during replay.
Full runs support replay; compact summaries need explicit regeneration.

Motion is prepared in short yielding batches with the same 1/240-second physics, stored temporarily
as 15 Hz Float32 frames, and interpolated for display. A 48 MiB preparation limit prevents runaway
memory use; no animation frames enter localStorage. Rendering can reduce to 30 fps if paint work exceeds
12 ms. Route geometry is simplified within 0.002 feet before coordinate rounding; collision contacts
and curved motion are retained without storing the full physics-step history.

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

Slickness maps linearly to deceleration from 5.4 down to 2.1 ft/s². Collision restitution is 0.94.
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
- `scripts/prediction-storage.js`: validated, size-aware localStorage library with a 25-shot limit.
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

## Saved-shot transfer and viewing controls

The library allows up to 25 shots, subject to the browser’s actual storage quota. Full records under
500 KiB stay full; larger records and quota retries use compact summaries. Per-record and total library
sizes are serialized UTF-8 JSON sizes, not guaranteed browser quota accounting. The drawer is at most
650px wide and sits on the right on larger screens. Shot names have no visible label: use the yellow
pencil to edit, then Enter or blur to save; Escape cancels. New saves open with their name selected.
The crystal ball loads a shot and the red trash button deletes it.

Export an individual shot or the entire library as a versioned JSON file. Import validates every
record before writing, merges without overwriting existing entries, skips identical name/data pairs,
and rejects an over-capacity library or failed quota write without partial changes. Files up to 50 MiB
are accepted. A conflicting ID with different content receives a new ID. Browser downloads and imports
need a live-browser check in addition to the pure format/merge regressions.

Zoom ranges from 100% to 400%. Use +/− or the slider, drag the zoomed canvas to pan, and Reset to fit.
Keyboard +/− and arrows work while the canvas is focused. Both modes keep the same physical coordinates.
The intended checkbox uses an asterisk with its explanation below the table; the shooting label sits
above the table so no column needs a long inline annotation. Only the outer corner triangles beside the kitchen scoring parallelograms match biscuit colors
and reverse with the viewed shooting end; the parallelograms and center triangle stay green. The center collection icon identifies the receiving Head/Foot.

Both main shooting and prediction replay default to real time. The 39-foot playing surface sits
within the full 52-foot court including standing areas. Friction is calibrated to approximately
3–6 seconds for an ordinary scoring delivery, with auto-aim recomputing the launch velocity.
Physics steps at 240 Hz; replay tracks interpolate 15 Hz samples independently of rendering FPS.
Prediction records retain their deceleration so historical saved outcomes replay with their original calibration.

Prediction shot controls edit speed, aim, court speed/drift, and accuracy in a separate draft.
Save accepts the draft; Reset restores the values from opening the editor, and Close/X/Escape discard it.
Retained outcomes stay visible with an out-of-sync warning until explicit Regenerate.
Column headings toggle ascending/descending sorts; the intended shot remains pinned.
Target drags can extend beyond the receiving baseline to request more power, up to the launch limit.
