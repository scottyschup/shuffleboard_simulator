/* exported
  initializePredictionControls,
  predictionPendingState,
  renderPredictionSettings,
  resetPredictionSettings
*/
'use strict';
let predictionSettings = null;
let predictionEditorInitial = null;
let predictionEditorDraft = null;

/** @type {[string, string, number, number, number][]} */
const predictionSettingFields = [
  [
    'Speed',
    'Shot speed',
    1,
    24,
    2,
  ],
  [
    'Aim',
    'Shot aim',
    -20,
    20,
    2,
  ],
  [
    'Slick',
    'Court speed',
    0,
    100,
    0,
  ],
  [
    'Drift',
    'Court drift',
    -100,
    100,
    0,
  ],
  [
    'Accuracy',
    'Accuracy',
    0,
    100,
    1,
  ],
];

function closePredictionControls() {
  const wasOpen = !element('predictionControls').hidden;

  element('predictionControls').hidden = true;
  element('predictionDialog').classList.remove('prediction-controls-open');
  element('openPredictionControls').setAttribute('aria-expanded', 'false');
  element('predictionSettingsValues').hidden = false;
  predictionEditorDraft = null;
  predictionEditorInitial = null;
  if (wasOpen && element('predictionDialog').open) {
    element('openPredictionControls').focus({ preventScroll: true });
    drawPrediction();
  }
}

function initializePredictionControls() {
  element('openPredictionControls').onclick = () => {
    if (!element('predictionControls').hidden) {
      closePredictionControls();

      return;
    }

    if (predictionBusy) {
      return;
    }

    PredictionAnimation.pause();
    predictionEditorInitial = predictionPendingState();
    predictionEditorDraft = structuredClone(predictionEditorInitial);
    renderPredictionControlFields();
    element('predictionControls').hidden = false;
    element('openPredictionControls').setAttribute('aria-expanded', 'true');
    element('predictionSettingsValues').hidden = true;
    element('predictionDialog').classList.add('prediction-controls-open');
    positionPredictionControls();
    element('settingsSpeed').focus({ preventScroll: true });
  };

  for (const id of ['closePredictionControls', 'closePredictionControlsX']) {
    element(id).onclick = closePredictionControls;
  }

  element('resetPredictionControls').onclick = () => {
    predictionEditorDraft = structuredClone(predictionEditorInitial);
    renderPredictionControlFields();
  };

  element('savePredictionControls').onclick = () => {
    if (!readPredictionControlFields()) {
      return;
    }

    predictionSettings = structuredClone(predictionEditorDraft);
    input('predictionAccuracy').value = predictionSettings.accuracy.toFixed(1);
    if (predictionSettings.accuracy !== predictionEditorInitial.accuracy) {
      saveAccuracyPreference(predictionSettings.accuracy);
    }

    closePredictionControls();
    renderPredictionSync();
    renderPredictionSettings();
  };

  for (const [key] of predictionSettingFields) {
    input('settings' + key).addEventListener('change', () => {
      if (readPredictionControlFields(key)) {
        renderPredictionControlFields();
      }
    });
  }

  queryElements('#predictionControls [data-setting]').forEach((button) => {
    button.onclick = () => {
      if (!readPredictionControlFields()) {
        return;
      }

      const key = button.dataset.setting;
      const field = input('settings' + key);

      field.value = String(Number(field.value) + Number(button.dataset.step));
      if (readPredictionControlFields(key)) {
        renderPredictionControlFields();
      }
    };
  });

  element('predictionControls').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePredictionControls();
    }
  });

  new ResizeObserver(() => {
    if (!element('predictionControls').hidden) {
      positionPredictionControls(false);
    }
  }).observe(element('predictionBody'));

  renderPredictionSettings();
}

function positionPredictionControls(scroll = true) {
  const editor = element('predictionControls');
  const distribution = queryElements('.prediction-distribution')[0].getBoundingClientRect();
  const court = element('predictionCourt');
  const narrow = window.innerWidth <= 700;

  editor.style.setProperty('--controls-left', (narrow ? 6 : distribution.left) + 'px');

  editor.style.setProperty(
    '--controls-width',
    (narrow ? window.innerWidth - 12 : distribution.width) + 'px',
  );

  const headingHeight = element('predictionHeading').parentElement.getBoundingClientRect().height;

  element('predictionDialog').style.setProperty(
    '--prediction-controls-space',
    editor.getBoundingClientRect().height + headingHeight + 18 + 'px',
  );

  if (scroll) {
    court.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  editor.style.setProperty(
    '--controls-top',
    Math.max(
      6,
      Math.min(
        court.getBoundingClientRect().top,
        window.innerHeight - editor.getBoundingClientRect().height - 6,
      ),
    ) + 'px',
  );

  drawPrediction();
}

function predictionPendingState() {
  const state = snapshot();
  const settings = predictionSettings;

  if (settings) {
    state.accuracy = settings.accuracy;
    state.aimPoint = structuredClone(settings.aimPoint);
    state.angle = settings.angle;
    state.court = structuredClone(settings.court);
    state.speed = settings.speed;
  }

  const field = input('predictionAccuracy');

  if (field.value.trim() && Number.isFinite(Number(field.value))) {
    state.accuracy = Math.max(0, Math.min(100, Number(field.value)));
  }

  return state;
}

function readPredictionControlFields(changed = '') {
  if (!predictionEditorDraft) {
    return false;
  }

  const values = {};

  for (const [
    key,
    label,
    min,
    max,
    precision,
  ] of predictionSettingFields) {
    const field = input('settings' + key);
    const value = Number(field.value);

    if (!field.value.trim() || !Number.isFinite(value)) {
      element('predictionControlsError').textContent = 'Enter a valid ' + label.toLowerCase() + '.';
      field.focus();

      return false;
    }

    values[key] = Number(Math.max(min, Math.min(max, value)).toFixed(precision));
  }

  const aimChanged = changed === 'Aim' || values.Aim !== predictionEditorDraft.angle;

  const courtChanged =
    values.Slick !== predictionEditorDraft.court.slick ||
    values.Drift !== predictionEditorDraft.court.drift;

  Object.assign(predictionEditorDraft, {
    accuracy: values.Accuracy,
    angle: values.Aim,
    speed: values.Speed,
  });

  Object.assign(predictionEditorDraft.court, {
    deceleration: physics.deceleration(values.Slick),
    drift: values.Drift,
    slick: values.Slick,
  });

  if (aimChanged) {
    predictionEditorDraft.aimPoint = null;
  }

  if (courtChanged && predictionEditorDraft.aimPoint) {
    const start = physics.startingPoint(
      predictionEditorDraft.color,
      predictionEditorDraft.position,
      predictionEditorDraft.launchY,
    );

    const solution = physics.targetShot(
      start,
      predictionEditorDraft.aimPoint,
      predictionEditorDraft.court.deceleration,
      values.Drift * 0.00055,
    );

    predictionEditorDraft.angle = Math.max(-20, Math.min(20, solution.angle));
    predictionEditorDraft.speed = Math.max(1, Math.min(24, solution.speed));
  }

  element('predictionControlsError').textContent = '';

  return true;
}

function renderPredictionControlFields() {
  const state = predictionEditorDraft;

  const values = {
    Accuracy: state.accuracy,
    Aim: state.angle,
    Drift: state.court.drift,
    Slick: state.court.slick,
    Speed: state.speed,
  };

  for (const [
    key,
    ,
    ,
    ,
    precision,
  ] of predictionSettingFields) {
    input('settings' + key).value = values[key].toFixed(precision);
  }

  element('predictionControlsError').textContent = '';
}

function renderPredictionSettings() {
  const state = predictionPendingState();

  const values = [
    state.speed.toFixed(2) + ' ft/s',
    state.angle.toFixed(2) + '°',
    state.court.slick + ' / 100',
    state.court.drift === 0
      ? 'None'
      : Math.abs(state.court.drift) + '% ' + (state.court.drift < 0 ? 'left' : 'right'),
    state.accuracy.toFixed(1) + '%',
  ];

  const summary = element('predictionSettingsValues');

  summary.replaceChildren();

  predictionSettingFields.forEach(([, label], index) => {
    const term = document.createElement('dt');
    const value = document.createElement('dd');

    term.textContent = label;
    value.textContent = values[index];
    summary.append(term, value);
  });
}

function resetPredictionSettings(state = null) {
  predictionSettings = state ? structuredClone(state) : null;
  input('predictionAccuracy').value = (state ? state.accuracy : accuracy()).toFixed(1);
  closePredictionControls();
  renderPredictionSettings();
}
