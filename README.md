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
Pigeon, Undo, Shoot, Replay, and the future prediction placeholder.

Undo restores the starting state of the last shot, including biscuits, shooter, aim, accuracy, and court
settings. Arrangement edits do not add Undo entries. Replay restores that starting state and immediately
shoots with fresh accuracy errors. Replay works after a completed shot or after Undo; it does not restore
an old sampled outcome. Clear court and practice setups reset shot history and preserve court settings.

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

- `npm test`: physics, accuracy distributions, and interaction regressions.
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
