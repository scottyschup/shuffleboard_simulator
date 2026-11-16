# Refactor decisions

Read the main [refactor instructions](refactor_agent_instructions.md) alongside these later user decisions.

## Phase order and current checkpoint

Implement one section at a time in order **1 → 4 → 2 → 3**, with a review checkpoint between sections.
Section 1 is implemented. Section 4 includes the behavior fixes, CSS split, and subsequent style/process
requests. Section 2 (layout) was accepted by the user. Section 3 (outcome prediction) is implemented for review.

## Layout clarifications

- The first drawing (`IMG_0731.jpg`) shows the magnified receiving view, full-court overview, and
  shooting-end/control panel. The control panel overlays the non-shooting side of the shooting end.
- Header controls retain Yellow/Black, the label “shooting from”, and 👤/🦶 for Head/Foot. The selected
  control is outlined. 🧹 clears the board. The question-mark button opens “Practice with a Purpose”.
- A sliding focus window spans the full court width. The initial layout uses the simpler full-width
  version; pinch zoom and desktop corner resizing are deferred.
- Only magnified views move biscuits. The full-court view moves the focus window.
- Rotate turns only the focus view 90° clockwise on each click, including its pointer mapping.
  Lock, Rotate, and the sole red Clear button form a group above that view.
- In mobile landscape, shooting is on the left and focus is in the middle. Preserve the user's compact
  portrait grid: `minmax(0, 1fr) 20px 138px`, with a 3px gap below 600px.
  Below 360px in portrait, the shooting panel spans the bottom row so its controls remain readable.
- Use native HTML `title` tooltips for icons. Clicks and focus must not open custom tooltip bubbles.
- Supply forms one alternating column between the views, excluding the queued shooter.
  With Yellow shooting on an empty board, seven supply biscuits start with Black. Only the top supply
  biscuit is draggable. A successful placement switches the shooter and shifts the remaining supply up.
- The second drawing (`IMG_0732.jpg`) specifies control groups for shot speed, aim, court speed, drift,
  shared accuracy, and shot actions. Accuracy +/- buttons step by 0.1 percentage points.
- Shot action order is Block, Pigeon, Undo, Shoot, Replay, and future Prediction. Block opens a modal
  with the existing Yellow/Black Tampa/St. Pete setups. Clear moved to the focus actions. Omit the chart button.
- A pigeon is a biscuit of the current color placed randomly just in front of the 7/kitchen line,
  entirely inside either 7, clear of scoring borders and other biscuits, within the four-per-color limit.
  Use 🦆 until a pigeon icon is available. The primary instructions list the other chosen icons.

## Behavior and prediction clarifications

- Share a single accuracy field between aim and speed. Use one decimal place and 0.1 steps.
- Keep fast-shot angular variation, including at 100% accuracy, as a court feature with a checkbox and
  threshold input. Default to enabled at 8.0 ft/s, with 0.1 threshold steps. Persist with court settings.
- Therefore 100% accuracy is deterministic only when the active fast-shot penalty is zero. Prediction
  must use the same enabled/threshold settings and sampling model as real shooting.
- Undo restores the last shot's starting state; arrangement edits do not add Undo entries. Replay
  restores that state and immediately fires with fresh errors rather than restoring an old outcome.
- Manually dropping a biscuit off court returns it to supply. Biscuits knocked off during a shot remain
  used in the dead-biscuit area. Preserve the shared inventory limit of four biscuits per color.
- The scoring-view lock prevents biscuit dragging while preserving target placement on biscuit centers.

## Verification context

Existing tests cover physics, accuracy distribution, pointer handling, inventory, shared accuracy,
modal focus return, supply placement, focus-only overview movement, and all four focus rotations.
The app was available in Chrome at `http://localhost:8000/` during this session; inspect the current
environment before assuming that server or address is still active. Keep all browser checks in a hidden
session; the user does not want Chrome refocused. Full assistive-technology conformance has not been established.

## Outcome prediction decisions

- The user approved starting section 3 on the `prediction-generator` branch after accepting layout.
- Default score table: final Yellow and Black board scores, including prior biscuits. The alternate
  view shows each player’s score change separately. No Trials column. A selected row filters the map.
- Compute intention with perfect accuracy and no fast-shot handicap. Pin and outline that score pair
  first, including at zero sampled likelihood; keep other rows in descending likelihood order.
- Show before and after scoreboards around the court; after follows the selected outcome or most likely
  outcome. Allow accuracy edits in the dialog followed by explicit regeneration.
- Connect biscuit starts to stopping/departure positions with translucent straight displacement lines.
- Show every biscuit, with individual, per-color, and all-biscuit visibility toggles. Visibility changes
  affect the heat map only; score distributions always describe the full run.
- Regeneration is explicit. Changing the board or shot/court inputs invalidates active results.
- Save up to 20 named runs to localStorage. Keep full trial records below 500 KiB; use compact summaries
  above that threshold or when needed to fit the available quota. Preserve existing saves on failure.
- Suggested names compare nominal start/end states, recognizing combinations such as replacing and
  kitchening an opponent through a friendly biscuit. Include current color and shot number; keep names editable.
- Saving expands the library, scrolls to the new entry, and focuses/selects its name.
  Load restores the starting board, settings, and retained results; users can then shoot or regenerate.
  Saved shots also support rename and delete.

## Prediction review refinements

- Accuracy is an in-place draft: retain the displayed run, mark Regenerate with a light orange outline,
  and show “Results and accuracy are out of sync. Click to regenerate.” Commit only on Regenerate.
- Delivery animation plays every sampled shot on one shared clock, using the original launches and
  batched motion preparation. Do not store frames or silently rerandomize saved runs.
- Negative scoreboard totals use red text. Outline the shooting player’s table header in their color.
- Use a nearly full-screen prediction dialog and a larger court. Keep table text at 16px with reduced
  cell padding; move explanatory score prose into native title/accessible-description tooltips.

## Drawer and multi-outcome review

- Saved shots opens in a bottom drawer above predictions, including immediately after Save. Keep native
  Escape/focus behavior and preserve the underlying prediction scroll position.
- The title/header is outside the prediction scroll area, flush to the top on mobile. Keep absolute
  accessible descriptions contained within the scrolling body to prevent outer-dialog auto-scroll.
- Animation always preserves the selected court view, including view changes during playback.
- Move map summaries and collection notes into native title/accessible-description tooltips.
- View controls are multi-select checkboxes. Checked rows combine their trials; with none checked show
  all trials. The lower scoreboard uses the most likely checked outcome, or overall outcome if none.
- Delta colors are relative to the shooter: own gains/opponent losses green, own losses/opponent gains
  red. Display zero score cells as — in both table modes.
