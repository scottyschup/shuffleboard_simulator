# Refactor decisions

Read the main [refactor instructions](refactor_agent_instructions.md) alongside these later user decisions.

## Phase order and current checkpoint

Implement one section at a time in order **1 → 4 → 2 → 3**, with a review checkpoint between sections.
Section 1 is implemented. Section 4 includes the behavior fixes, CSS split, and subsequent style/process
requests. Section 2 (layout) and section 3 (outcome prediction) remain to be implemented.

## Layout clarifications

- The first drawing (`IMG_0731.jpg`) shows the magnified receiving view, full-court overview, and
  shooting-end/control panel. The control panel overlays the non-shooting side of the shooting end.
- Header controls retain Yellow/Black, the label “shooting from”, and 👤/🦶 for Head/Foot. The selected
  control is outlined. 🧹 clears the board. The question-mark button opens “Practice with a Purpose”.
- A sliding focus window defaults to the full court width. Assess pinch zoom within it on mobile and
  corner resizing on desktop; implement the simple full-width version if zoom adds excessive complexity.
- Only magnified views move biscuits. The full-court view moves the focus window.
- Supply forms one alternating column between the views, starting with the current shooter's color.
  With Yellow shooting on an empty board, seven supply biscuits start with Black. Only the top supply
  biscuit is draggable. A successful placement switches the shooter and shifts the remaining supply up.
- The second drawing (`IMG_0732.jpg`) specifies control groups for shot speed, aim, court speed, drift,
  shared accuracy, and shot actions. Accuracy +/- buttons step by 0.1 percentage points.
- Action buttons are clear, place block (modal with existing Yellow/Black Tampa/St. Pete setups), Undo,
  Replay, and future prediction. The clear button is red. Omit the forgotten sixth/chart button.
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

Existing tests cover physics, accuracy distribution, pointer handling, inventory, and section 4 behavior.
The app was available in Chrome at `http://localhost:8000/` during this session; inspect the current
environment before assuming that server or address is still active. Browser verification covered the
tooltip's outside-click dismissal, lock state, and notes dialog/Escape/focus return. Full mobile and
assistive-technology conformance has not been established.
