/* exported
  bindDialog,
  nudge,
  nudgeAccuracy,
  nudgeCourt,
  nudgeSpeed,
  openDialog,
  placePigeon
*/
'use strict';
const dialogReturnFocus = new Map();

function bindDialog(id, trigger) {
  const dialog = /** @type {HTMLDialogElement} */ (element(id));

  dialog.addEventListener('close', () => (dialogReturnFocus.get(id) || trigger).focus());

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      dialog.close();
    }
  });
}

function initializeAccuracyRestore() {
  const saved = loadAccuracyPreference();

  if (saved === null) {
    return;
  }

  const initial = accuracy();

  if (saved === initial) {
    try {
      localStorage.removeItem('shotLab.accuracy');
    } catch {
      /* The simulator also works when browser storage is unavailable. */
    }

    return;
  }

  element('restoreSavedAccuracy').textContent = `Restore prior accuracy of ${saved.toFixed(1)}%`;
  element('useDefaultAccuracy').textContent = `Use default accuracy of ${initial.toFixed(1)}%`;
  bindDialog('accuracyRestoreDialog', element('accuracy'));

  const choose = (value) => {
    element('accuracy').value = value.toFixed(1);
    update();
    element('accuracyRestoreDialog').close();
  };

  element('restoreSavedAccuracy').onclick = () => choose(saved);

  element('useDefaultAccuracy').onclick = () => {
    try {
      localStorage.removeItem('shotLab.accuracy');
    } catch {
      /* The simulator also works when browser storage is unavailable. */
    }

    choose(initial);
  };

  openDialog('accuracyRestoreDialog', 'restoreSavedAccuracy');
}

function nudge(amount) {
  if (running || dragging) {
    return;
  }

  element('angle').value = Math.max(-20, Math.min(20, value('angle') + amount)).toFixed(2);
  aimPoint = null;
  update();
}

function nudgeAccuracy(amount) {
  if (running || dragging) {
    return;
  }

  element('accuracy').value = Math.max(0, Math.min(100, accuracy() + amount)).toFixed(1);
  saveAccuracyPreference(accuracy());
  update();
}

function nudgeCourt(id, amount) {
  if (running || dragging) {
    return;
  }

  const minimum = id === 'slick' ? 0 : -100;

  input(id).value = String(Math.max(minimum, Math.min(100, value(id) + amount)));
  saveCourtSettings();
  if (aimPoint) {
    aimAt(
      aimPoint.x,
      aimPoint.y,
      true,
    );
  }

  update();
}

function nudgeSpeed(amount) {
  if (running || dragging) {
    return;
  }

  element('speed').value = Math.max(1, Math.min(24, value('speed') + amount)).toFixed(2);
  update();
}

function openDialog(id, focusId = null) {
  if (dragging) {
    return;
  }

  dialogReturnFocus.set(id, document.activeElement);
  /** @type {HTMLDialogElement} */ (element(id)).showModal();
  if (focusId) {
    element(focusId).focus();
  }
}

function placePigeon(pigeonColor = color) {
  if (
    running ||
    dragging ||
    physics.remainingBiscuits(
      discs,
      pigeonColor,
      color,
    ) === 0
  ) {
    return;
  }

  const y = 37.5 - physics.R - physics.LINE / 2 - 0.02;
  const slots = [];

  for (let x = physics.R; x <= 6 - physics.R; x += 0.02) {
    const point = { x, y };

    if (physics.score({ ...point, out: false }) === 7 && canDrop(point)) {
      slots.push(point);
    }
  }

  if (!slots.length) {
    element('result').textContent = 'No clear space for a pigeon along the 7 line.';

    return;
  }

  const point = slots[Math.floor(Math.random() * slots.length)];

  saveArrangement();

  discs.push(
    createDisc(
      point.x,
      point.y,
      pigeonColor,
    ),
  );

  element('result').textContent = pigeonColor + ' pigeon placed in the 7.';
  update();
}

element('aboutBtn').onclick = () => openDialog('about');
element('accuracyDown').onclick = () => nudgeAccuracy(-0.1);
element('accuracyUp').onclick = () => nudgeAccuracy(0.1);

element('biscuitLock').onclick = () => {
  if (!running && !dragging) {
    biscuitsLocked = !biscuitsLocked;
    update();
  }
};

element('black').onclick = () => switchShooter('black');
element('closeDialog').onclick = () => element('about').close();
element('driftLeft').onclick = () => nudgeCourt('drift', -1);
element('driftRight').onclick = () => nudgeCourt('drift', 1);
element('footEnd').onclick = () => selectShootingEnd('foot');
element('headEnd').onclick = () => selectShootingEnd('head');
element('left').onclick = () => nudge(-0.05);

element('placeBlock').onclick = () => {
  element('blockStatus').textContent = '';
  openDialog('setupDialog');
};

element('placePigeon').onclick = () => placePigeon('yellow');
element('placeBlackPigeon').onclick = () => placePigeon('black');

element('reset').onclick = () => {
  pendingSupplyColor = null;
  setup('open');
};

element('retry').onclick = () => {
  if (!running && !dragging && lastShot) {
    fire(true);
  }
};

element('right').onclick = () => nudge(0.05);

element('rotateFocus').onclick = () => {
  if (!dragging) {
    focusRotation = (focusRotation + 1) % 4;
    draw();
  }
};

element('shoot').onclick = () => fire();
element('slickDown').onclick = () => nudgeCourt('slick', -1);
element('slickUp').onclick = () => nudgeCourt('slick', 1);
element('speedDown').onclick = () => nudgeSpeed(-0.05);
element('speedUp').onclick = () => nudgeSpeed(0.05);

element('undo').onclick = () => {
  if (running || dragging || !shotHistory.length) {
    return;
  }

  lastShot = structuredClone(shotHistory.pop());
  restoreShot(lastShot);
  lastShotUndone = true;
  element('result').textContent = 'Shot undone. Adjust and try again.';
  update();
};

element('yellow').onclick = () => switchShooter('yellow');
element('focusPosition').addEventListener('input', () => setFocus(value('focusPosition')));

element('accuracy').addEventListener('change', () => {
  element('accuracy').value = accuracy().toFixed(1);
  saveAccuracyPreference(accuracy());
  update();
});

for (const id of [
  'angle',
  'drift',
  'position',
  'slick',
  'speed',
]) {
  element(id).addEventListener('input', () => {
    if (id === 'angle') {
      aimPoint = null;
    } else if (aimPoint && id !== 'speed') {
      aimAt(
        aimPoint.x,
        aimPoint.y,
        true,
      );
    }

    if (id === 'drift' || id === 'slick') {
      saveCourtSettings();
    }

    update();
  });
}

for (const id of ['fastShotInaccuracy', 'fastShotThreshold']) {
  element(id).addEventListener('change', () => {
    element('fastShotThreshold').value = fastShotOptions().threshold.toFixed(1);
    saveCourtSettings();
    update();
  });
}

for (const id of ['prediction', 'trails']) {
  element(id).addEventListener('change', draw);
}

queryElements('[data-setup]').forEach((trigger) => {
  trigger.onclick = () => {
    if (placeBlock(trigger.dataset.setup)) {
      element('setupDialog').close();
    }
  };
});

queryElements('[data-close]').forEach((trigger) => {
  trigger.onclick = () => /** @type {HTMLDialogElement} */ (element(trigger.dataset.close)).close();
});

bindDialog('about', element('aboutBtn'));
bindDialog('setupDialog', element('placeBlock'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    pendingSupplyColor = null;

    return;
  }

  const id = /** @type {HTMLElement} */ (event.target).id;

  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }

  if (id === 'overview') {
    const direction = shootingEnd === 'head' ? 1 : -1;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      setFocus(focusStart + (event.key === 'ArrowUp' ? 0.5 : -0.5) * direction);
    }
  } else if (id === 'target' || id === 'shooting') {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      nudge(-0.05);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nudge(0.05);
    }
  }
});

for (const name of ['contextmenu', 'dragstart']) {
  document.addEventListener(name, (event) => {
    if (/** @type {Element} */ (event.target).closest?.('canvas, button, input[type="range"]')) {
      event.preventDefault();
    }
  });
}

initializePredictions();
initializeSupply();
loadCourtSettings();
setup('open');
initializeAccuracyRestore();
for (const id of [
  'overview',
  'shooting',
  'target',
]) {
  new ResizeObserver(draw).observe(element(id));
}
