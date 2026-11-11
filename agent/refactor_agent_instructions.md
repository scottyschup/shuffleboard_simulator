# Shuffleboard Shot Lab refactor

I want to make several improvements. The overall goal is to maximize viewport utilization (i.e. minimize unused white space), make the interface as clear, simple, and intuitive as possible, and optimize for mobile use.

I've broken the work into chunks:

## 1. Code Readability refactor

Rewrite the code to be more human readable.

* Follow standard JS best practices.
* Use comments only when the code is more complex or atypical, or changing it could introduce sneaky bugs. 
* Split code into separate files when it makes sense to do so. Keep all JS in a scripts dir, all CSS in a style dir and leave all icons in the icons dir. Don't use `dist` anymore. Add new dirs if it makes sense to.
* Remove any dead code you find, especially unused CSS and HTML elements that CSS hides and never shows.
* Keep lines less than 120 characters and follow what I call the rule of 3s. If there are three (or more) of something on the same line (e.g. an HTML tag with >=3 attributes, an object with >=3 properties, a function call with >=3 args, array with >=3 elements, etc.) split each attr/prop/element/etc onto their own lines. So,

  ```js
    // ❌
    example(arg1, arg2, arg3);

    // ❌
    example(
      arg1, arg2, arg3,
    );

    // ✅
    example(
      arg1,
      arg2,
      arg3,
    );
  ```

## 2. Layout refactor

See the attached screenshot of rough drawings. The following notes should clarify the sketches.

### Shot and Control Panels

This will be a magnification of the shooting end of the court and will have a control panel roughly half the width of the court which will appear on top of the side that is not shooting.

The control panel should all be buttons with icons for the button text. The icons are in the icons dir or will be standard emoji. Across the app, always give icons tooltip hover messages that have their English labels as indicated below:

#### General (persistent) controls (to be saved to localStorage)

Court speed: <img src="icons/042-slippery-floor.png" />

* Faster court: <img src="icons/040-car.png" />
* Slower court: <img src="icons/037-snail.png" />

Court drift: <img src="icons/043-slippery-road.png" />

* Drift left: <img src="icons/046-arrow-up-left.png" />
* Drift right: <img src="icons/047-arrow-up-right.png" />

#### Shooting

Shot speed: <img src="icons/041-speedometer.png" />

* Harder shot: <img src="icons/010-muscle.png" />
* Softer shot: <img src="icons/022-pinch.png" />

Aim: <img src="icons/008-aim.png" />

* Nudge left: <img src="icons/044-left-arrow.png" />
* Nudge right: <img src="icons/045-right-arrow.png" />


#### Action buttons

* Shoot!: <img src="icons/035-puck.png" />
* Clear board: <img src="icons/048-broom.png" />
* Undo shot: <img src="icons/027-undo-circular-arrow.png" />
* Redo shot: <img src="icons/028-redo.png" /> (or possibly refresh-page-option icon)
* Place a block: 🙅
* Place a pigeon: I will add an icon with pigeon in the name. Until I do use the 🦆 emoji as a placeholder.



## 3. Shot Outcome Prediction feature

* When accuracy is 100%, the shot will be the same every time, so just show the shot and it's outcomes.
* When accuracy is < 100%, run the same shot 100 times (or 1000 if the added runtime is less than a second)
* Store the results of each shot. Have one object for starting state and turn info, and an array for every biscuit shot detailing where it ends up and the resulting score on the court.
  So something like:

  ```js
  shotPrediction = {
    shooting: {
      color: 'yellow', // or 'black'
      from: 'head', // or 'foot'
    },
    preShot: {
      score: [yellowScore, blackScore], 
      onTheBoard: [
        [biscuitToBeShot.x, biscuitToBeShot.y],
        [biscuit1.x, biscuit1.y],
        ...
        [biscuitN.x, biscuitN.y],
      ],
    },
    postShots: [
      {
        score: [yellowScore, blackScore],
        onTheBoard: [
          [shotBiscuit.x, shotBiscuit.y],
          [biscuit1.x, biscuit1.y],
          ...
          [biscuitN.x, biscuitN.y],
        ],
      },
      ...
    ],
  }
  ```

  This may require creating an absolute grid system for the court so that a biscuit's `[x,y]` values are the same regardless of screen size.
* for visualization:
  * create a table showing the result of the shot in terms of score delta after the shot is complete and the percentage of shots that ended with that result.
  * create a heat map. An idea I had was to render all the results but make the opacity of each one very low so that the overlapping results will show as more opaque. If this doesn't seem like it would work or there's a better way, lmk.

## 4. Other Minor improvements

* There should never be more than 4 of either color biscuit at a time. E.g. if there is one yellow on the board, one black off the board, and one yellow lined up to shoot, in the alley there should be 3 on the black side and 2 on the yellow side. This is already how the app works, just want to make sure this requirement never gets lost.
* Add a biscuit lock to the scoring end view that makes the biscuits not draggable so when placing the intended target, it doesn't accidentally move or select a biscuit instead. Use lock/unlock icons for the toggle.
* Dragging a biscuit and dropping it anywhere **off the court** puts it back to the side
* Change accuracy %s and their step values to one decimal place instead of 2
* Undo should undo the last shot. Redo, should undo the last shot and immediately replay it, not undo the last undo.
* The tooltips often won't go away on mobile. Make sure clicking anywhere outside the tooltip text closes them. Remove the info tootlip from the setup tab; only use tooltips when they convey necessary information, not just little blurbs or tips.
* Make sure tooltips and modals are fully accessible following WCAG 2.1 AA standards.

(Steering added to this phase: "Also as part of this phase I want to split the CSS into separate files by page area. You can keep app.css and leave the global rules there. But then for each major section of the page, create a separate file for ease of organization.")
