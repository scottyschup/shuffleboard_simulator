/* exported
  dragControlSelector,
  nudge,
  nudgeSpeed,
  placeCourtActions,
  selectTab,
  selectView,
  tabButtons
*/
'use strict';
const tabButtons = [...queryElements('[data-tab]')];

function nudge(n) {
  if (running) {
    return;
  }

  element('angle').value = Math.min(20, Math.max(-20, value('angle') + n)).toFixed(2);
  aimPoint = null;
  update();
}

function nudgeAccuracy(amount) {
  if (running) {
    return;
  }

  element('accuracy').value = Math.max(0, Math.min(100, accuracy() + amount)).toFixed(1);
  update();
}

function nudgeSpeed(n) {
  if (running) {
    return;
  }

  element('speed').value = Math.min(18, Math.max(1, value('speed') + n)).toFixed(2);
  update();
}

function placeCourtActions() {
  const destination =
    window.innerWidth < 1000 ? element('courtToolbar') : element('overviewHeading');

  if (element('courtActions').parentElement !== destination) {
    destination.append(element('courtActions'));
  }
}

function selectTab(n) {
  tabButtons.forEach((b, i) => {
    b.setAttribute('aria-pressed', String(i === n));
    element('controlPage' + i).classList.toggle('active', i === n);
  });
}

function selectView(full) {
  mobileView = full ? 'full' : 'scoring';
  document.body.classList.toggle('full-view', full);
  element('fullView').setAttribute('aria-pressed', String(full));
  element('scoringView').setAttribute('aria-pressed', String(!full));
  draw();
}

tabButtons.forEach((b, i) => (b.onclick = () => selectTab(i)));

element('toggleControls').onclick = () => {
  const hidden = document.body.classList.toggle('controls-hidden');

  element('toggleControls').setAttribute('aria-expanded', String(!hidden));
  element('toggleControls').textContent = hidden ? 'Show controls' : 'Hide controls';
  draw();
};

element('fullView').onclick = () => selectView(true);
element('scoringView').onclick = () => selectView(false);
for (const id of [
  'position',
  'angle',
  'speed',
  'slick',
  'drift',
]) {
  element(id).addEventListener('input', () => {
    if (id === 'position' && aimPoint) {
      aimAt(
        aimPoint.x,
        aimPoint.y,
        true,
      );
    } else if (id === 'angle') {
      aimPoint = null;
    }

    update();
  });
}

element('accuracy').addEventListener('change', () => {
  element('accuracy').value = accuracy().toFixed(1);
  update();
});

element('accuracyDown').onclick = () => nudgeAccuracy(-0.1);
element('accuracyUp').onclick = () => nudgeAccuracy(0.1);
for (const id of [
  'slick',
  'drift',
  'fastShotInaccuracy',
  'fastShotThreshold',
]) {
  element(id).addEventListener('change', () => {
    element('fastShotThreshold').value = fastShotOptions().threshold.toFixed(1);
    saveCourtSettings();
    update();
  });
}

element('biscuitLock').onclick = () => {
  if (running || dragging) {
    return;
  }

  biscuitsLocked = !biscuitsLocked;
  update();
};

for (const id of ['prediction', 'trails']) {
  element(id).addEventListener('change', draw);
}

for (const c of ['yellow', 'black']) {
  element(c).onclick = () => switchShooter(c);
}

element('shoot').onclick = () => fire();

element('retry').onclick = () => {
  if (running || dragging || !lastShot) {
    return;
  }

  fire(true);
};

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

element('reset').onclick = () => setup('open');
queryElements('[data-setup]').forEach((b) => (b.onclick = () => setup(b.dataset.setup)));
element('left').onclick = () => nudge(-0.05);
element('right').onclick = () => nudge(0.05);
element('speedDown').onclick = () => nudgeSpeed(-0.05);
element('speedUp').onclick = () => nudgeSpeed(0.05);
initializeTooltips();

const dragControlSelector =
  'canvas,.biscuit-supply,.controls input[type=range],.controls ' +
  'button,.shooting-picker button,.shoot-area button,.mobile-toolbar ' +
  'button,.toolbar-actions button';

for (const event of ['contextmenu', 'dragstart']) {
  document.addEventListener(event, (e) => {
    if (/** @type {Element} */ (e.target).closest?.(dragControlSelector)) {
      e.preventDefault();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (
    e.defaultPrevented ||
    e.isComposing ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    element('about').open ||
    !['overview', 'target'].includes(/** @type {Element} */ (e.target).id)
  ) {
    return;
  }

  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    nudge(-0.05);
  }

  if (e.code === 'ArrowRight') {
    e.preventDefault();
    nudge(0.05);
  }
});

element('aboutBtn').onclick = () => {
  closeTooltips();
  element('about').showModal();
};

element('closeDialog').onclick = () => element('about').close();

element('about').addEventListener('click', (e) => {
  if (e.target === element('about')) {
    const r = element('about').getBoundingClientRect();

    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      element('about').close();
    }
  }
});

element('about').addEventListener('close', () => element('aboutBtn').focus());
placeCourtActions();
window.addEventListener('resize', placeCourtActions);
new ResizeObserver(draw).observe(element('overview'));
new ResizeObserver(draw).observe(element('target'));
setup('open');
selectView(true);
selectTab(1);
