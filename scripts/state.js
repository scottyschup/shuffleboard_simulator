/* exported
  accumulator,
  accuracy,
  aimDistance,
  aimPoint,
  applyCourtSettings,
  biscuitsLocked,
  button,
  canDrop,
  color,
  courtDeceleration,
  courtSettings,
  createDisc,
  discs,
  dragging,
  drift,
  element,
  fastShotOptions,
  focusLength,
  focusRotation,
  focusStart,
  input,
  lastFrame,
  lastShot,
  lastShotUndone,
  launch,
  launchY,
  loadCourtSettings,
  moving,
  paths,
  pendingSupplyColor,
  physics,
  preview,
  queryElements,
  restoreShot,
  running,
  saveArrangement,
  saveCourtSettings,
  shootingEnd,
  shot,
  shotDisc,
  shotHistory,
  snapshot,
  time,
  value,
  viewMaps
*/
'use strict';

function applyCourtSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return;
  }

  /** @type {[string, number, number][]} */
  const ranges = [
    [
      'slick',
      0,
      100,
    ],
    [
      'drift',
      -100,
      100,
    ],
  ];

  for (const [
    id,
    min,
    max,
  ] of ranges) {
    if (Number.isFinite(settings[id])) {
      input(id).value = String(Math.max(min, Math.min(max, settings[id])));
    }
  }

  if (typeof settings.enabled === 'boolean') {
    element('fastShotInaccuracy').checked = settings.enabled;
  }

  if (Number.isFinite(settings.threshold) && settings.threshold >= 0) {
    element('fastShotThreshold').value = settings.threshold.toFixed(1);
  }
}

/** @param {string} id */
function button(id) {
  return /** @type {HTMLButtonElement} */ (element(id));
}

function canDrop(p, except = null) {
  return (
    p &&
    p.x >= 0 &&
    p.x <= 6 &&
    p.y >= 0 &&
    p.y <= 39 &&
    !discs.some((d) => d !== except && !d.out && Math.hypot(d.x - p.x, d.y - p.y) < 2 * physics.R)
  );
}

function courtSettings() {
  return {
    drift: value('drift'),
    slick: value('slick'),
    ...fastShotOptions(),
  };
}

/**
 * @template {string} K
 * @param {K} id
 * @returns {LabElements[K]}
 */
function element(id) {
  return /** @type {LabElements[K]} */ (document.getElementById(id));
}

function fastShotOptions() {
  const threshold = value('fastShotThreshold');

  return {
    enabled: element('fastShotInaccuracy').checked,
    threshold:
      String(element('fastShotThreshold').value).trim() !== '' &&
      Number.isFinite(threshold) &&
      threshold >= 0
        ? threshold
        : 8,
  };
}

/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ (element(id));
}

function loadCourtSettings() {
  try {
    applyCourtSettings(JSON.parse(localStorage.getItem('shotLab.court')));
  } catch {
    /* Ignore unavailable storage and malformed saved settings. */
  }
}

/** @param {string} selector */
function queryElements(selector) {
  return /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector));
}

function restoreShot(state) {
  discs = structuredClone(state.discs);
  paths = structuredClone(state.paths);
  color = state.color;
  shootingEnd = state.shootingEnd;
  launchY = state.launchY;
  aimPoint = state.aimPoint ? { ...state.aimPoint } : null;
  for (const id of [
    'angle',
    'speed',
    'position',
  ]) {
    input(id).value = state[id];
  }

  element('accuracy').value = state.accuracy.toFixed(1);
  applyCourtSettings(state.court);
  saveCourtSettings();
}

function saveArrangement() {
  paths = [];
}

function saveCourtSettings() {
  try {
    localStorage.setItem('shotLab.court', JSON.stringify(courtSettings()));
  } catch {
    /* The simulator also works when browser storage is unavailable. */
  }
}

function snapshot() {
  return {
    accuracy: accuracy(),
    aimPoint: aimPoint
      ? {
          ...aimPoint,
        }
      : null,
    angle: value('angle'),
    color,
    court: courtSettings(),
    discs: structuredClone(discs),
    launchY,
    paths: structuredClone(paths),
    position: value('position'),
    shootingEnd,
    speed: value('speed'),
  };
}

const physics = Physics;
let discs = [],
  color = 'yellow',
  running = false,
  shotHistory = [],
  lastShot = null,
  preview = null,
  aimPoint = null;
let biscuitsLocked = false;
let lastShotUndone = false;
let dragging = null,
  launchY = 1.18,
  shootingEnd = 'head';
let paths = [],
  time = 0,
  accumulator = 0,
  lastFrame = 0,
  shotDisc = null,
  viewMaps = {};

const accuracy = () =>
  String(element('accuracy').value).trim() !== '' && Number.isFinite(value('accuracy'))
    ? Math.max(0, Math.min(100, value('accuracy')))
    : 95;

const aimDistance = () => {
  const l = launch();

  return aimPoint
    ? Math.hypot(aimPoint.x - l.x, aimPoint.y - l.y)
    : (33.1 - l.y) / Math.cos((value('angle') * Math.PI) / 180);
};

const courtDeceleration = () => physics.deceleration(value('slick'));

const createDisc = (
  x,
  y,
  c = color,
) => ({
  color: c,
  id: Math.random().toString(36).slice(2),
  out: false,
  vx: 0,
  vy: 0,
  x,
  y,
});

const drift = () => value('drift') * 0.00055;

const launch = () =>
  physics.startingPoint(
    color,
    value('position'),
    launchY,
  );

const moving = (d) => !d.out && Math.hypot(d.vx, d.vy) > 0.00001;

const shot = (randomize = false) => {
  const l = launch(),
    distance = aimDistance(),
    speed = randomize ? physics.applyAccuracy(value('speed'), accuracy()) : value('speed');

  const stats = physics.aimStats(
    accuracy(),
    speed,
    distance,
    fastShotOptions(),
  );

  const angle = randomize
    ? physics.sampleAim(
        value('angle'),
        accuracy(),
        speed,
        distance,
        Math.random,
        fastShotOptions(),
      )
    : value('angle');

  const r = (angle * Math.PI) / 180,
    d = createDisc(l.x, l.y);

  d.vx = Math.sin(r) * speed;
  d.vy = Math.cos(r) * speed;
  d.launchAngle = angle;
  d.launchSpeed = speed;
  d.aimSigma = stats.sigmaDeg;

  return d;
};

const value = (id) => Number(input(id).value);
let focusStart = 24.75;
let focusRotation = 0;
const focusLength = 16.5;
let pendingSupplyColor = null;
