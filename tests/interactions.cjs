const assert = require('node:assert/strict');
const { createFixture } = require('./dom-fixture.cjs');
const physics = require('../scripts/physics.js');

const {
  click,
  dispatch,
  document,
  ids,
  pointEvent,
  run,
} = createFixture();

function inventory() {
  for (const color of ['black', 'yellow']) {
    const counts = run(`({ used: discs.filter(d => d.color === '${color}').length,
      queued: color === '${color}' && !running && physics.remainingBiscuits(discs, color) > 0 ? 1 : 0,
      supply: supplyOrder().filter(c => c === '${color}').length })`);

    assert.equal(counts.queued + counts.supply + counts.used, 4);
  }
}

function send(
  id,
  type,
  x,
  y,
  extra = {},
) {
  dispatch(
    ids.get(id),
    type,
    pointEvent(
      id,
      x,
      y,
      {
        button: -1,
        pointerId: 10,
        pointerType: 'touch',
        ...extra,
      },
    ),
  );
}

function supplyDrop(
  x,
  y,
  id = 'target',
  cancel = false,
) {
  const first = ids.get('supply0');

  dispatch(
    first,
    'pointerdown',
    {
      button: -1,
      pointerId: 11,
      pointerType: 'touch',
    },
  );

  dispatch(
    first,
    'pointermove',
    pointEvent(
      id,
      x,
      y,
      {
        button: -1,
        pointerId: 11,
        pointerType: 'touch',
      },
    ),
  );

  dispatch(
    first,
    cancel ? 'pointercancel' : 'pointerup',
    pointEvent(
      id,
      x,
      y,
      {
        button: -1,
        pointerId: 11,
        pointerType: 'touch',
      },
    ),
  );
}

assert.equal(run('color'), 'yellow');
assert.equal(run('shootingEnd'), 'head');
assert.equal(ids.get('accuracy').value, '95.0');
assert.equal(run('focusStart'), 24.75);
assert.equal(run('supplyOrder().join(",")'), 'black,yellow,black,yellow,black,yellow,black');
assert.equal(ids.get('supply0').disabled, false);
assert.equal(ids.get('supply1').disabled, true);
inventory();
for (const end of ['head', 'foot']) {
  run(`selectShootingEnd('${end}');setup('open')`);
  const before = JSON.stringify(run('snapshot()'));

  send(
    'overview',
    'pointerdown',
    3,
    15,
  );

  send(
    'overview',
    'pointermove',
    3,
    11,
    { pointerId: 99 },
  );

  const windowStart = run('focusStart');

  send(
    'overview',
    'pointermove',
    3,
    10,
  );

  send(
    'overview',
    'pointerup',
    3,
    10,
  );

  assert.notEqual(run('focusStart'), windowStart);

  assert.equal(
    JSON.stringify(run('snapshot()')),
    before,
    'Overview only moves the focus window',
  );

  run('setFocus(24.75)');

  send(
    'target',
    'pointerdown',
    4,
    34,
  );

  assert.ok(Math.abs(run('aimPoint.x') - 4) < 1e-8);
  supplyDrop(4.5, 35);
  assert.equal(run('discs.length'), 1);
  assert.equal(run('color'), 'black');
  inventory();

  send(
    'target',
    'pointerdown',
    4.5,
    35,
  );

  send(
    'target',
    'pointermove',
    4,
    36,
  );

  send(
    'target',
    'pointerup',
    4,
    36,
  );

  assert.ok(Math.abs(run('discs[0].y') - 36) < 1e-8);
  const shooter = run('launch()');

  send(
    'shooting',
    'pointerdown',
    shooter.x,
    shooter.y,
  );

  assert.equal(run('dragging.kind'), 'shooter');

  send(
    'shooting',
    'pointermove',
    1,
    0.8,
  );

  send(
    'shooting',
    'pointerup',
    1,
    0.8,
  );

  assert.ok(Math.abs(run('launchY') - 0.8) < 1e-8);
  const original = JSON.stringify(run('discs'));

  send(
    'target',
    'pointerdown',
    4,
    36,
  );

  send(
    'target',
    'pointermove',
    -1,
    35,
  );

  send(
    'target',
    'pointercancel',
    -1,
    35,
  );

  assert.equal(JSON.stringify(run('discs')), original);
}

console.log(
  'PASS: focus-only overview, pointer ownership, Head/Foot target/supply mappi' +
    'ng, and shooting-end dragging.',
);

run("setup('open');setFocus(24.75)");

supplyDrop(
  3,
  34,
  'target',
  true,
);

assert.equal(run('discs.length'), 0);
supplyDrop(3, 34);
const same = JSON.stringify(run('discs'));

supplyDrop(3, 34);

assert.equal(
  JSON.stringify(run('discs')),
  same,
  'Overlapping drop cancels without advancing the queue',
);

run("setup('open')");
for (let index = 0; index < 8; index++) {
  supplyDrop(index % 2 ? 4.5 : 1.5, 28 + Math.floor(index / 2) * 2);
  assert.equal(run('discs.length'), index + 1);
  inventory();
}

assert.equal(run('supplyOrder().length'), 0);
assert.equal(ids.get('shoot').disabled, true);
run("setup('open');discs=[createDisc(4,34,'black')];update()");
click('biscuitLock');

send(
  'target',
  'pointerdown',
  4,
  34,
);

assert.equal(run('dragging'), null);
assert.ok(Math.abs(run('aimPoint.x') - 4) < 1e-8);
supplyDrop(2, 34);

assert.equal(
  run('discs.length'),
  1,
  'Lock blocks supply placement into the focus view',
);

click('biscuitLock');
for (const [x, y] of [
  [-0.1, 34],
  [6.1, 34],
  [4, -0.1],
  [4, 39.1],
]) {
  run("setup('open');discs=[createDisc(4,34,'black')];update()");

  send(
    'target',
    'pointerdown',
    4,
    34,
  );

  send(
    'target',
    'pointermove',
    x,
    y,
  );

  send(
    'target',
    'pointerup',
    x,
    y,
  );

  assert.equal(run('discs.length'), 0);
  inventory();
}

console.log(
  'PASS: top-only alternating supply, overlap/cancel handling, four-per-color ' +
    'limits, lock, and manual removal.',
);

click('placeBlock');
assert.equal(ids.get('setupDialog').open, true);
const block = document.querySelectorAll('[data-setup]')[0];

dispatch(block, 'click');
assert.equal(ids.get('setupDialog').open, false);
assert.equal(run('discs.length'), 1);
for (const color of ['yellow', 'black']) {
  run(`setup('open');switchShooter('${color}')`);
  for (let i = 0; i < 3; i++) {
    click('placePigeon');
    assert.equal(physics.score(run('discs[discs.length-1]')), 7);
    assert.equal(run('discs[discs.length-1].color'), color);
    inventory();
  }

  assert.equal(ids.get('placePigeon').disabled, true);
}

console.log(
  'PASS: block modal closes after setup and pigeons stay fully in a 7 without ' +
    'exhausting the queued shooter.',
);

run("setup('open');element('accuracy').value='90.0';element('speed').value='6';update()");
const originalApply = physics.applyAccuracy;
let samples = 0;

physics.applyAccuracy = (speed, accuracy) =>
  originalApply(
    speed,
    accuracy,
    () => (++samples % 2 ? 0.1 : 0.9),
  );

const beforeShot = JSON.stringify(run('snapshot()'));

click('shoot');
const speed = run('shotDisc.launchSpeed');

run('finish();discs.push(createDisc(4,34));saveArrangement()');
click('retry');
assert.notEqual(run('shotDisc.launchSpeed'), speed);
assert.equal(run('shotHistory.length'), 1);
assert.equal(run('discs.length'), 1);
run('finish()');
click('undo');
assert.equal(JSON.stringify(run('snapshot()')), beforeShot);
click('retry');
assert.equal(run('running'), true);
assert.equal(samples, 3);
physics.applyAccuracy = originalApply;
run('finish()');

console.log(
  'PASS: shot-only Undo, full pre-shot restoration, and fresh immediate Replay remain intact.',
);

click('accuracyDown');
assert.equal(ids.get('accuracy').value, '89.9');
click('accuracyUp');
assert.equal(ids.get('accuracy').value, '90.0');
click('slickUp');
assert.equal(run("value('slick')"), 51);
click('driftLeft');
assert.equal(run("value('drift')"), -1);

run(
  "element('fastShotInaccuracy').checked=false;element('accuracy').value=100;e" +
    "lement('speed').value=18;update()",
);

assert.equal(run('shot(true).aimSigma'), 0);
assert.equal(ids.get('fastShotThreshold').disabled, true);
run('saveCourtSettings();element("slick").value=1;loadCourtSettings()');
assert.equal(run('value("slick")'), 51);
click('aimSettings');
assert.equal(ids.get('settingsDialog').open, true);
assert.equal(document.activeElement.id, 'angle');
ids.get('settingsDialog').close();

assert.equal(
  document.activeElement.id,
  'aimSettings',
  'Dialog returns to the icon that opened it',
);

click('aboutBtn');
assert.equal(ids.get('about').open, true);
click('closeDialog');
assert.equal(document.activeElement.id, 'aboutBtn');

console.log(
  'PASS: icon controls, shared accuracy, persistent court options, and native-' +
    'dialog focus hooks.',
);

run("setup('open');setFocus(24.75)");

dispatch(
  ids.get('supply0'),
  'click',
  { detail: 0 },
);

assert.equal(run('pendingSupplyColor'), 'black');

send(
  'target',
  'pointerdown',
  4,
  34,
);

assert.equal(run('discs.length'), 1);
assert.equal(run('pendingSupplyColor'), null);
inventory();

dispatch(
  ids.get('supply0'),
  'click',
  { detail: 0 },
);

dispatch(
  document,
  'keydown',
  { key: 'Escape' },
);

assert.equal(run('pendingSupplyColor'), null);
const arrangement = JSON.stringify(run('snapshot()'));

run('running=true');

send(
  'overview',
  'pointerdown',
  3,
  15,
);

send(
  'overview',
  'pointermove',
  3,
  10,
);

send(
  'overview',
  'pointerup',
  3,
  10,
);

assert.equal(
  JSON.stringify(run('snapshot()')),
  arrangement,
  'Watching another court region does not alter a moving shot',
);

run('running=false;setFocus(24.75)');

ids.get('target').rect = {
  height: 250,
  left: 0,
  top: 0,
  width: 700,
};

run('draw()');
assert.equal(run('viewMaps.target.vertical'), false);

send(
  'target',
  'pointerdown',
  4.5,
  36,
);

assert.ok(Math.abs(run('aimPoint.x') - 4.5) < 1e-8);
assert.ok(Math.abs(run('aimPoint.y') - 36) < 1e-8);

console.log(
  'PASS: keyboard supply placement, Escape cancellation, focus during animatio' +
    'n, and landscape coordinate conversion.',
);

const rotated = createFixture();

for (const [width, height] of [
  [230, 469],
  [700, 250],
]) {
  rotated.ids.get('target').rect = {
    height,
    left: 0,
    top: 0,
    width,
  };

  for (const end of ['head', 'foot']) {
    rotated.run(`selectShootingEnd('${end}');setup('open');focusRotation=0;draw()`);
    const state = JSON.stringify(rotated.run('snapshot()'));
    const overview = JSON.stringify(rotated.run('viewMaps.overview.map(2,34)'));
    const shooting = JSON.stringify(rotated.run('viewMaps.shooting.map(2,1)'));

    for (let turn = 0; turn < 4; turn++) {
      const before = rotated.run('viewMaps.target.map(2,34)');
      const beside = rotated.run('viewMaps.target.map(3,34)');
      const scale = rotated.run('viewMaps.target.scale');

      rotated.click('rotateFocus');
      const after = rotated.run('viewMaps.target.map(2,34)');
      const next = rotated.run('viewMaps.target.map(3,34)');
      const nextScale = rotated.run('viewMaps.target.scale');

      assert.ok(
        Math.abs((next[0] - after[0]) / nextScale + (beside[1] - before[1]) / scale) < 1e-8,
      );

      assert.ok(
        Math.abs((next[1] - after[1]) / nextScale - (beside[0] - before[0]) / scale) < 1e-8,
      );

      assert.equal(JSON.stringify(rotated.run('snapshot()')), state);
      assert.equal(JSON.stringify(rotated.run('viewMaps.overview.map(2,34)')), overview);
      assert.equal(JSON.stringify(rotated.run('viewMaps.shooting.map(2,1)')), shooting);

      rotated.dispatch(
        rotated.ids.get('target'),
        'pointerdown',
        rotated.pointEvent(
          'target',
          4.5,
          36,
        ),
      );

      assert.ok(Math.abs(rotated.run('aimPoint.x') - 4.5) < 1e-8);
      assert.ok(Math.abs(rotated.run('aimPoint.y') - 36) < 1e-8);
      rotated.run("discs=[createDisc(4.5,36,'black')];update()");
      for (const [
        type,
        x,
        y,
      ] of [
        [
          'pointerdown',
          4.5,
          36,
        ],
        [
          'pointermove',
          4,
          35,
        ],
        [
          'pointerup',
          4,
          35,
        ],
      ]) {
        rotated.dispatch(
          rotated.ids.get('target'),
          type,
          rotated.pointEvent(
            'target',
            x,
            y,
          ),
        );
      }

      assert.ok(Math.abs(rotated.run('discs[0].x') - 4) < 1e-8);
      assert.ok(Math.abs(rotated.run('discs[0].y') - 35) < 1e-8);
      rotated.run("setup('open')");
    }

    assert.equal(rotated.run('focusRotation'), 0);
  }
}

rotated.run("discs=[createDisc(4,35,'black')];update()");
rotated.click('reset');
assert.equal(rotated.run('discs.length'), 0);

console.log(
  'PASS: four clockwise rotations, unchanged shot state and other views, rotat' +
    'ed aim/drag mapping, and relocated Clear.',
);
