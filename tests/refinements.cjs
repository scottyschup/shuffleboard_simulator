const assert = require('node:assert/strict');
const { createFixture } = require('./dom-fixture.cjs');
const model = require('../scripts/prediction-model.js');
const physics = require('../scripts/physics.js');
const storage = require('../scripts/prediction-storage.js');

function bend(path) {
  const a = path[0],
    b = path.at(-1),
    dx = b[0] - a[0],
    dy = b[1] - a[1];

  return Math.max(
    ...path.map(
      (p) => Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.max(1e-9, Math.hypot(dx, dy)),
    ),
  );
}

function drop(
  fixture,
  index,
  x = 4,
  y = 34,
) {
  const button = fixture.ids.get('supply' + index);

  fixture.dispatch(
    button,
    'pointerdown',
    { pointerId: 5 },
  );

  fixture.dispatch(
    button,
    'pointermove',
    fixture.pointEvent(
      'target',
      x,
      y,
      { pointerId: 5 },
    ),
  );

  fixture.dispatch(
    button,
    'pointerup',
    fixture.pointEvent(
      'target',
      x,
      y,
      { pointerId: 5 },
    ),
  );
}

function state(overrides = {}) {
  return {
    accuracy: 100,
    aimPoint: null,
    angle: 0,
    color: 'yellow',
    court: {
      deceleration: physics.deceleration(50),
      drift: 0,
      enabled: false,
      slick: 50,
      threshold: 8,
    },
    discs: [],
    launchY: 1.18,
    paths: [],
    position: 12,
    shootingEnd: 'head',
    speed: 7.5 * Math.sqrt(physics.deceleration(50) / 0.795),
    ...overrides,
  };
}

const f = createFixture();

for (const end of ['head', 'foot']) {
  f.run("selectShootingEnd('" + end + "');setup('open')");
  const start = f.run('snapshot()');

  for (const [
    type,
    x,
    y,
  ] of [
    [
      'pointerdown',
      4,
      34,
    ],
    [
      'pointermove',
      4.3,
      36,
    ],
  ]) {
    f.dispatch(
      f.ids.get('target'),
      type,
      f.pointEvent(
        'target',
        x,
        y,
        { pointerId: 7 },
      ),
    );
  }

  assert.ok(Math.abs(f.run('aimPoint.x') - 4.3) < 1e-7);
  assert.ok(Math.abs(f.run('aimPoint.y') - 36) < 1e-7);

  f.dispatch(
    f.ids.get('target'),
    'pointercancel',
    f.pointEvent(
      'target',
      4.3,
      36,
      { pointerId: 7 },
    ),
  );

  assert.deepEqual(
    f.run('snapshot()'),
    start,
    'Cancel restores the pre-drag aim and settings',
  );

  for (const [
    type,
    x,
    y,
  ] of [
    [
      'pointerdown',
      4,
      34,
    ],
    [
      'pointermove',
      4.2,
      35,
    ],
    [
      'pointerup',
      4.2,
      35,
    ],
  ]) {
    f.dispatch(
      f.ids.get('target'),
      type,
      f.pointEvent(
        'target',
        x,
        y,
        { pointerId: 8 },
      ),
    );
  }

  assert.ok(Math.abs(f.run('aimPoint.y') - 35) < 1e-7);
  assert.equal(f.run('dragging'), null);
}

f.run(
  "setup('open');discs=[createDisc(1,30,'yellow'),createDisc(2,32,'black'),cre" +
    "ateDisc(5,33,'black')];update()",
);

drop(f, f.run("supplyOrder().indexOf('yellow')"));

assert.equal(
  f.run('color'),
  'yellow',
  'Equal queued counts preserve the shooter',
);

f.run("setup('open');discs=[createDisc(2,32,'black'),createDisc(5,33,'black')];update()");
drop(f, 2);

assert.equal(
  f.run('discs.length'),
  3,
  'A middle queued biscuit can be placed',
);

assert.equal(
  f.run('color'),
  'black',
  'Pulling the majority shooter color switches the shooter',
);

f.run("setup('open')");
drop(f, 2);

assert.equal(
  f.run('color'),
  'yellow',
  'Pulling the opposite color preserves the shooter',
);

assert.equal(
  f.run('supplyOrder().every((c,i,a)=>!i||c!==a[i-1])'),
  true,
  'Equal remaining supply alternates',
);

f.click('placeBlackPigeon');
assert.equal(f.run('discs.at(-1).color'), 'black');
assert.equal(physics.score(f.run('discs.at(-1)')), 7);
assert.equal(f.run('color'), 'yellow');
f.click('openSettings');
assert.equal(f.ids.get('settingsDialog').open, true);
f.ids.get('settingsDialog').close();
assert.equal(f.document.activeElement.id, 'openSettings');
f.click('placePigeon');
assert.equal(f.run('discs.at(-1).color'), 'yellow');
assert.equal(physics.score(f.run('discs.at(-1)')), 7);
f.run("setup('open');discs=Array.from({length:3},(_,i)=>createDisc(1+i,32,'yellow'));update()");
assert.equal(f.ids.get('placePigeon').disabled, true);
assert.equal(f.ids.get('placeBlackPigeon').disabled, false);
assert.equal(f.ids.get('speedSettings').tagName, 'SPAN');
assert.equal(f.ids.get('predictionCourtView').getAttribute('role'), 'group');
assert.equal(f.ids.get('predictionDeltaScore').getAttribute('aria-pressed'), 'true');

assert.equal(
  f.ids.get('yellowScore').parentElement.parentElement.parentElement.className,
  'section-heading',
);

const parked = {
  color: 'black',
  out: true,
  vx: 0,
  vy: 0,
  x: 0,
  y: 0,
};

physics.collectOffCourt([parked]);
assert.equal(parked.y, 39 + 1.5 * physics.R);

const live = {
  color: 'yellow',
  out: false,
  vx: 0,
  vy: 0,
  x: parked.x,
  y: 39.2,
};

physics.step(
  [live, parked],
  physics.DT,
  physics.deceleration(50),
);

assert.equal(
  live.y,
  39.2,
  'Overlapping collection display never collides with a live biscuit',
);

f.ids.get('overview').rect = {
  height: 600,
  left: 0,
  top: 0,
  width: 144,
};

f.run('draw()');

assert.ok(
  f.run('viewMaps.overview.scale') * 40 > f.ids.get('overview').getBoundingClientRect().height - 10,
  'The side full court fills its height',
);

for (const end of ['head', 'foot']) {
  const launch = physics.startingPoint(
    'yellow',
    12,
    1.18,
  );

  const collision = model.prepare(
    state({
      discs: [
        {
          color: 'black',
          id: 'target',
          out: false,
          vx: 0,
          vy: 0,
          x: launch.x + 0.2,
          y: 32,
        },
      ],
      shootingEnd: end,
    }),
  );

  const outcome = model.trial(collision);

  assert.ok(
    bend(outcome.paths.at(-1)) > 0.1,
    'Glancing collision produces a bent route rather than a chord',
  );

  assert.ok(outcome.paths.at(-1).length > 2);
  collision.outcomes = [outcome];
  collision.count = 1;
  const legacy = structuredClone(collision);

  delete legacy.outcomes[0].paths;

  assert.deepEqual(
    model.points(legacy).at(-1).path,
    outcome.paths.at(-1),
    'Full legacy saves reconstruct the sampled route',
  );

  const curved = model.trial(
    model.prepare(
      state({
        court: {
          deceleration: physics.deceleration(50),
          drift: 80,
          enabled: false,
          slick: 50,
          threshold: 8,
        },
        shootingEnd: end,
      }),
    ),
  );

  assert.ok(bend(curved.paths.at(-1)) > 0.01, 'Drift curves are retained');
}

// Identical board totals can hide whether it was the delivered biscuit that went in the kitchen.
const record = model.prepare(
  state({
    discs: [
      {
        color: 'yellow',
        id: 'prior',
        out: false,
        vx: 0,
        vy: 0,
        x: 1.5,
        y: 36,
      },
    ],
  }),
);

const base = model.trial(record);

record.outcomes = [
  {
    ...structuredClone(base),
    ends: [
      [
        1.5,
        36,
        0,
      ],
      [
        1.5,
        38.2,
        0,
      ],
    ],
    positions: [
      [
        1.5,
        36,
        0,
      ],
      [
        1.5,
        38.2,
        0,
      ],
    ],
    score: [-3, 0],
  },
  {
    ...structuredClone(base),
    ends: [
      [
        1.5,
        38.2,
        0,
      ],
      [
        1.5,
        36,
        0,
      ],
    ],
    positions: [
      [
        1.5,
        38.2,
        0,
      ],
      [
        1.5,
        36,
        0,
      ],
    ],
    score: [-3, 0],
  },
];

record.outcomes.forEach((outcome) => delete outcome.selfKitchen);
record.count = 2;

assert.deepEqual(
  model.selectionGroups(record).map((g) => g.count),
  [1, 1],
);

for (const run of [record, model.summarize(record)]) {
  assert.ok(storage.validRecord(run));
  const fx = createFixture();

  fx.context.saved = run;
  fx.run("element('predictionDialog').showModal();loadPrediction(saved)");
  assert.equal(fx.ids.get('predictionSelectedChance').textContent, '100.0%');
  assert.equal(fx.ids.get('animatePrediction').disabled, !!run.bins);

  assert.equal(
    fx.ids.get('predictionTableBody').children.at(-1).children[4].children[0].children[0].checked,
    true,
  );

  const self = fx.document
    .querySelectorAll('#predictionScenarios button')
    .find((b) => b.dataset.scenario === 'self-kitchen');

  self.onclick();
  assert.equal(fx.ids.get('predictionSelectedChance').textContent, '50.0%');
  assert.equal(fx.ids.get('animatePrediction').getAttribute('aria-label'), 'Play selected shots');
  const row = fx.ids.get('predictionTableBody').children.find((r) => r.dataset.score === '-3,0');
  const checkbox = row.children[4].children[0].children[0];

  assert.equal(
    checkbox.indeterminate,
    true,
    'A scenario can select only part of a score row',
  );

  checkbox.checked = true;
  checkbox.onchange();
  assert.equal(fx.ids.get('predictionSelectedChance').textContent, '100.0%');

  fx.document
    .querySelectorAll('#predictionScenarios button')
    .find((b) => b.dataset.scenario === 'black-increases')
    .onclick();

  assert.equal(fx.ids.get('predictionSelectedChance').textContent, '0.0%');
  assert.equal(fx.ids.get('animatePrediction').disabled, true);

  assert.equal(
    fx.run(
      'PredictionModel.points(predictionResult).filter(p=>PredictionModel.matches(' +
        'p.selectionKey,predictionFilter)).length',
    ),
    0,
  );

  fx.click('predictionShowAll');
  assert.equal(fx.ids.get('predictionSelectedChance').textContent, '100.0%');

  fx.run(
    'predictionResult.beforeScore=[0,10];predictionResult.intended.score=[7,0];r' +
      'enderPredictionTable()',
  );

  assert.equal(fx.ids.get('predictionTableBody').children[0].children[2].textContent, 'Yellow +17');
  assert.equal(fx.ids.get('predictionTableBody').children[0].children[0].dataset.shooter, 'yellow');
}

console.log(
  'PASS: draggable targets and queue, independent pigeons, compact collection,' +
    ' actual routes, scenario unions and probabilities, and score advantage.',
);

const oldCollection = model.prepare(
  state({
    discs: [
      {
        color: 'black',
        id: 'old-out',
        out: true,
        parked: true,
        vx: 0,
        vy: 0,
        x: 0.75,
        y: 40,
      },
    ],
  }),
);

oldCollection.outcomes = [model.trial(oldCollection)];
oldCollection.count = 1;
const oldFixture = createFixture();

oldFixture.context.saved = oldCollection;
oldFixture.run("element('predictionDialog').showModal();loadPrediction(saved);update()");

assert.ok(
  oldFixture.run('predictionResult'),
  'Loading an old collection layout does not invalidate the saved run on update',
);

assert.equal(oldFixture.run('discs[0].y'), 39 + 1.5 * physics.R);
{
  const separate = structuredClone(record);

  separate.outcomes[1].score = [0, 0];
  for (const data of [separate, model.summarize(separate)]) {
    const only = createFixture();

    only.context.saved = data;
    only.run("element('predictionDialog').showModal();loadPrediction(saved)");
    const before = JSON.stringify(only.run('predictionResult'));
    const rows = only.ids.get('predictionTableBody').children;
    const selected = rows.find((row) => row.dataset.score === '-3,0');
    const button = selected.children[4].children[1];

    assert.equal(button.textContent, 'Only');
    button.onclick();
    assert.equal(only.ids.get('predictionSelectedChance').textContent, '50.0%');
    for (const row of rows) {
      assert.equal(row.children[4].children[0].children[0].checked, row.dataset.score === '-3,0');
    }

    assert.equal(JSON.stringify(only.run('predictionResult')), before);
    only.click('predictionShowAll');
    assert.equal(only.ids.get('predictionSelectedChance').textContent, '100.0%');
  }
}
