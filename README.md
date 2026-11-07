# Shuffleboard Shot Lab

Plain JavaScript, HTML and CSS. No package installation, framework, or build step.

Open `dist/index.html` in a browser, or serve the `dist` directory with any static web server.
An optional Google Fonts stylesheet has local system-font fallbacks.

## Use

Choose a practice setup, click the scoring-end view to aim, adjust launch speed and court slickness, then shoot. Clicking a target sets both direction and launch speed for an unobstructed shot, using current slickness and drift. Other biscuits can change the destination on contact. Higher slickness reduces friction while keeping launch speed unchanged.

There are clearing, St. Pete, Tampa, and kitchen setups. Clear court resets to an empty board. Optional uniform drift, path prediction, trails, color selection, starting-position adjustment, undo, and retry support practice. Each color has four biscuits, including its queued shooter and collected biscuits. Colors alternate after shots settle; Undo restores the previous shooter.

Space has no shooting shortcut, so typing in comments or editors cannot fire a shot. Arrow keys adjust aim by 0.05 degrees only while a court canvas has focus. Native sliders also support keyboard adjustment.

## Model

Feet and seconds; 6-inch equal-mass discs; 39 by 6 ft playing area; 9 ft triangles; 18-inch kitchens; 3/4-inch scoring borders. A disc must clear every cell border to score. The kitchen separator is ignored for scoring. Far dead line is 3 ft before the apex (25.5 ft from the shooting baseline). Short discs are collected behind the far kitchen at rest. Partial edge overhang remains in play; biscuits are collected only once completely past an edge, without rebound. Collected biscuits remain visible behind the far kitchen, score zero, do not collide, and continue to count toward the used-biscuit total and color allowance. They can be dragged back onto the court. The kitchen has angled outer borders.

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

Drag a black or yellow supply biscuit from beside either court view near the dead line and drop it onto the court. A new supply biscuit replaces it. The supply grays out at four of that color, counting the queued shooter. Invalid or overlapping drops are cancelled. Drag a stationary biscuit to move it, including to a partially overhanging position. Overlapping placements are prevented. Undo restores arrangement changes as well as shots, including shooter color, target, and launch settings. Retry repeats the previous shot. Every displaced biscuit has a predicted path and endpoint.

Desktop shows both court views within the viewport. Below 1000px, toggle Scoring end / Full court, use the Setup / Shot / Court control tabs, and Hide controls to expand the court. Browser checks cover a 390 × 844 mobile viewport and 1000 × 650 compact desktop viewport.

The scoring-end view includes the shufflegram and far dead line, using a single scale on both axes. Full-court orientation follows the available canvas shape. Geometry follows Eldridge, Shuffleboard Basics p.1, and Robertson, Making Your Hammer Count p.3: the 7 base is six feet wide, with kitchen sides inset above and flaring toward the baseline. Rendering and scoring share the same vertices.

Launch speed has ±0.05 ft/s buttons. The starting-position slider keeps both colors clear of the painted outer shooting-area lines, including the diagonal sides. Four separate buttons create Yellow St. Pete, Yellow Tampa, Black St. Pete, and Black Tampa setups, mirroring the shooting side as appropriate. Aim supports ±20° to reach court targets from either starting area.

Moving the starting-position slider preserves the selected target and recomputes angle and launch speed. Supply biscuits use pointer capture for mouse/touch dragging; existing court biscuits remain draggable.

The queued shooter is draggable within its starting area in the full-court view, including depth changes. The position slider follows horizontal movement; selected targets stay fixed while angle and speed recalculate. Click the black starting half to queue black or the yellow half to queue yellow. Border clearance and per-color limits still apply.

The mobile/tablet score panel sizes itself to fit both signed totals; verified with -40 for both colors at 980px and 390px widths without overflowing or adding page scrolling.

## Shooting end

The Head/Foot toggle in the header defaults to Head. It changes the shooting direction while keeping the full-court Head/Foot locations fixed. The receiving-end view, setup positions, target clicks, queued-shooter dragging, color-side clicks, scoring, deadline removal, predictions, and collection follow the selected direction. Switching ends preserves existing live biscuits in their physical locations and clears the prior aim target. Undo restores the previous shooting end and arrangement. Clear court and practice setups keep the selected shooting end.

Sliders and court drag surfaces suppress context menus, text selection, and touch callouts. Secondary mouse/pen buttons cannot start drags. Touch events do not require mouse button or primary-pointer flags, so emulated touch is accepted. Drags remain bound to their initiating pointer until release or cancellation.

## Interaction regression checks

Run `node tests/interactions.cjs` in addition to the physics checks. This exercises the actual app handlers in a minimal DOM fixture with standard touch and emulated-touch event shapes: target clicks, supply drops, existing-biscuit and queued-shooter drags, pointer ownership, secondary-click rejection, and mirrored Head/Foot supply sides. The scoring-end view mirrors across the court when shooting from Foot, with yellow on the left and black on the right; its target/drag coordinate conversion mirrors identically.

Full-court color sides remain fixed: yellow occupies the bottom half in the horizontal view at both Head and Foot, and black stays on top. Switching ends reverses only the length coordinate, preserving cross-court disc positions and velocities. The scoring-end detail retains its separate Head/Foot side orientation.

## Accuracy

Base aim accuracy and speed accuracy each accept 0.00–100.00%. Speed retains uniform percentage error: `speed ± speed × (1 − speedAccuracy / 100)`. For example 90% at 6 ft/s gives 5.4–6.6 ft/s.

Aim now uses additive zero-mean Gaussian angular error, independent of the nominal aim angle. Even 0° varies unless base aim accuracy is 100% and speed is no more than 8 ft/s. Skill standard deviation is `6° × (1 − baseAimAccuracy / 100)`. The 6° scale is an illustrative simulator parameter, not a measured player rating; the percentage is not itself a hit probability. Gaussian tails allow occasional larger errors even at high accuracy.

Above 8 ft/s an independent speed standard deviation is added: `sigmaSpeed = asin(0.5 / targetDistance) / 0.6744897501960817 × max(0, (actualSpeed − 8) / 10)`, with the angle converted to degrees. Total spread is `hypot(sigmaSkill, sigmaSpeed)`. At 18 ft/s and perfect base aim, the central 50% of angular outcomes make contact with a virtual six-inch target biscuit; the other 50% completely miss. Contact uses both biscuit radii, allowing a six-inch centerline clearance. Lower skill can miss more, and speeds above 18 ft/s increase the penalty further. 

Calibration assumes exact speed, no drift, no intervening contacts, and a virtual biscuit centered on the nominal aim line at the selected range. With no target selected, the reference range is the receiving 8s. The live estimate is a contact miss rate, not a scoring probability. At nonzero drift or with other contacts, actual outcomes can differ. Speed variation is sampled before aim so the penalty follows actual launch speed. Starting position never varies. Predictions remain nominal; the result shows actual sampled launch values. Undo restores settings; Retry samples anew.

Research basis: Zhang, Daw & Maloney (2013), https://doi.org/10.1371/journal.pcbi.1003080 ; Zhang, Daw & Maloney (2015), https://doi.org/10.1038/nn.4055 ; Harris & Wolpert (1998), https://doi.org/10.1038/29528 . These support Gaussian motor-error modeling and a speed–accuracy trade-off. They do not validate this simulator's angular scale, 8/18 ft/s thresholds, or calibration.

Run `node tests/aim-accuracy.cjs` for distribution checks and an end-to-end 6,000-shot physical collision test. The calibrated run produced 49.90% misses at 18 ft/s.

Clear court is a bordered toolbar button beside Hide/Show controls. Their shared toolbar stays outside the hideable controls, moving into the Full court header on desktop. The footer source-download and source-notes links have been removed; model notes remain available through How it works.

## Starting defaults

Both accuracy controls start at 95.00%, slickness at 50, drift at 0 (None), Full court selected on mobile, Head selected as the shooting end, and Yellow queued first. The inside starting-position limit follows the center separation triangle: at shooting depth y its right edge is x = 3.25 − y/6. Biscuit centers are offset from that diagonal by their radius plus half the painted line width and the same small clearance used at the outer border. Black uses the mirrored boundary. Both dragging and the position slider use these dynamic limits.
