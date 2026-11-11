/* exported
  element,
  input,
  button,
  queryElements,
  physics,
  discs,
  color,
  running,
  shotHistory,
  redoHistory,
  lastShot,
  preview,
  aimPoint,
  dragging,
  mobileView,
  launchY,
  shootingEnd,
  paths,
  time,
  accumulator,
  lastFrame,
  shotDisc,
  viewMaps,
  value,
  courtDeceleration,
  drift,
  launch,
  moving,
  createDisc,
  accuracy,
  aimDistance,
  shot,
  descriptions,
  snapshot,
  restoreShot,
  saveArrangement,
  canDrop
*/
'use strict';
/**
 * @template {string} K
 * @param {K} id
 * @returns {LabElements[K]}
 */
function element(id) {
  return /** @type {LabElements[K]} */ (document.getElementById(id));
}
/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ (element(id));
}
/** @param {string} id */
function button(id) {
  return /** @type {HTMLButtonElement} */ (element(id));
}
/** @param {string} selector */
function queryElements(selector) {
  return /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector));
}
const physics = Physics;
let discs = [],
  color = 'yellow',
  running = false,
  shotHistory = [],
  redoHistory = [],
  lastShot = null,
  preview = null,
  aimPoint = null;
let dragging = null,
  mobileView = 'full',
  launchY = 1.18,
  shootingEnd = 'head';
let paths = [],
  time = 0,
  accumulator = 0,
  lastFrame = 0,
  shotDisc = null,
  viewMaps = {};
const value = (id) => Number(input(id).value),
  courtDeceleration = () => physics.deceleration(value('slick')),
  drift = () => value('drift') * 0.00055;
const launch = () =>
  physics.startingPoint(
    color,
    value(
      'position',
    ),
    launchY,
  );
const moving = (d) => !d.out && Math.hypot(d.vx, d.vy) > 0.00001;
const createDisc = (
  x,
  y,
  c = color,
) => ({
  x,
  y,
  color:
    c,
  vx: 0,
  vy: 0,
  out: false,
  id: Math.random()
    .toString(
      36,
    )
    .slice(
      2,
    ),
});
const accuracy = (id) =>
  String(input(id).value).trim() !== '' && Number.isFinite(value(id))
    ? Math.max(0, Math.min(100, value(id)))
    : 95;
const aimDistance = () => {
  const l = launch();
  return aimPoint
    ? Math.hypot(aimPoint.x - l.x, aimPoint.y - l.y)
    : (33.1 - l.y) / Math.cos((value('angle') * Math.PI) / 180);
};
const shot = (randomize = false) => {
  const l = launch(),
    distance = aimDistance(),
    speed = randomize
      ? physics.applyAccuracy(value('speed'), accuracy('speedAccuracy'))
      : value('speed');
  const stats = physics.aimStats(
    accuracy(
      'aimAccuracy',
    ),
    speed,
    distance,
  );
  const angle = randomize
    ? physics.sampleAim(
        value(
          'angle',
        ),
        accuracy(
          'aimAccuracy',
        ),
        speed,
        distance,
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
const descriptions = {
  open: 'An open board. Aim for an 8 and get a feel for your speed.',
  clear:
    'Clip the black disc with a firm shot. Try to send both discs off the board.',
  stpete:
    'A St. Pete guard is across from the shooter, near the height of the apex. ' +
    'Find the hide behind it.',
  tampa:
    'A Tampa guard is near the apex, on the shooter’s side. Try to tuck an 8 behind it.',
  kitchen:
    'Bump the black disc from the 8 toward the kitchen. Too much speed sends it past the baseline.',
};
function snapshot() {
  return {
    discs:
      structuredClone(
        discs,
      ),
    paths:
      structuredClone(
        paths,
      ),
    color,
    aimPoint:
      aimPoint
        ? {
            ...aimPoint,
          }
        : null,
    angle:
      value(
        'angle',
      ),
    speed:
      value(
        'speed',
      ),
    position:
      value(
        'position',
      ),
    launchY,
    shootingEnd,
    aimAccuracy:
      accuracy(
        'aimAccuracy',
      ),
    speedAccuracy:
      accuracy(
        'speedAccuracy',
      ),
  };
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
  for (const id of ['aimAccuracy', 'speedAccuracy']) {
    input(id).value = state[id].toFixed(2);
  }
}
function saveArrangement() {
  shotHistory.push(snapshot());
  redoHistory = [];
  paths = [];
  lastShot = null;
}
function canDrop(p, except = null) {
  return (
    p &&
    p.x >= -0.24 &&
    p.x <= 6.24 &&
    p.y >= 0 &&
    p.y <= 39 &&
    !discs.some((d) => d !== except && !d.out && Math.hypot(d.x - p.x, d.y - p.y) < 2 * physics.R)
  );
}
