const assert = require('node:assert/strict');
const { createFixture } = require('./dom-fixture.cjs');

function chooseBlock(f, name) {
  f.dispatch(
    f.document.querySelectorAll('[data-setup]').find((button) => button.dataset.setup === name),
    'click',
  );
}

function pointer(
  f,
  id,
  type,
  x,
  y,
) {
  f.dispatch(
    f.ids.get(id),
    type,
    f.pointEvent(
      id,
      x,
      y,
      { pointerId: 42 },
    ),
  );
}

const f = createFixture();

assert.equal(f.document.querySelectorAll('#controlPanel .adjustment').length, 5);

assert.equal(
  f.ids.get('accuracy').parentElement.parentElement.parentElement.className,
  'control-groups',
);

f.ids.get('shooting').parentElement.rect = {
  height: 200,
  left: 0,
  top: 0,
  width: 600,
};

f.run('draw()');
for (const [width, height] of [
  [1200, 200],
  [500, 280],
  [310, 180],
]) {
  f.ids.get('shooting').rect = {
    height,
    left: 0,
    top: 0,
    width,
  };

  f.ids.get('shooting').parentElement.rect = {
    height,
    left: 0,
    top: 0,
    width,
  };

  for (const end of ['head', 'foot']) {
    for (const color of ['yellow', 'black']) {
      f.run("selectShootingEnd('" + end + "');switchShooter('" + color + "');draw()");
      const left = parseFloat(f.ids.get('controlPanel').style.left);
      const panelWidth = parseFloat(f.ids.get('controlPanel').style.width);
      const position = f.run('viewMaps.shooting.map(launch().x,launch().y)[0]');
      const radius = f.run('physics.R * viewMaps.shooting.scale');

      assert.ok(left >= 4 && left + panelWidth <= width - 4 + 1e-8);

      assert.ok(
        left + panelWidth <= position - radius || left >= position + radius,
        'Panel clears the queued biscuit without resizing the court canvas',
      );
    }
  }
}

f.run("selectShootingEnd('head');switchShooter('yellow')");
assert.equal(f.run('predictionScoreMode'), 'delta');
assert.equal(f.ids.get('predictionDeltaScore').getAttribute('aria-pressed'), 'true');
f.click('predictionFinalScore');
assert.equal(f.run('predictionScoreMode'), 'final');
f.click('predictionDeltaScore');
assert.equal(f.run('predictionScoreMode'), 'delta');

f.run(
  'predictionResult=PredictionModel.prepare(snapshot());predictionResult.outco' +
    'mes=[PredictionModel.trial(predictionResult)];predictionResult.count=1;elem' +
    "ent('predictionDialog').showModal();loadPrediction(predictionResult)",
);

assert.equal(f.ids.get('predictionTableCaption').textContent, 'Outcomes');
f.click('predictionFullCourt');
assert.equal(f.run('predictionCourtView'), 'full');
assert.equal(f.ids.get('predictionCourt').dataset.view, 'full');
f.click('predictionScoringEnd');
assert.equal(f.run('predictionCourtView'), 'receiving');
assert.equal(f.ids.get('predictionScoringEnd').getAttribute('aria-pressed'), 'true');

assert.deepEqual(
  f.document
    .querySelectorAll('#predictionScenarios button')
    .map((button) => button.dataset.scenario),
  [
    'self-kitchen',
    'yellow-increases',
    'yellow-decreases',
    'black-increases',
    'black-decreases',
  ],
);

assert.equal(f.ids.get('predictionScenarios').parentElement.children[0].id, 'predictionShowAll');
assert.equal(f.ids.get('predictionBiscuits').parentElement.className, 'prediction-filters');
assert.ok(f.ids.get('predictionScenarios').children[1].children[0].classList.contains('yellow'));
assert.ok(f.ids.get('predictionScenarios').children[1].children[2].classList.contains('black'));
const scoreFilters = f.ids.get('predictionScenarios').children[1];

assert.equal(scoreFilters.children.length, 4);
assert.equal(scoreFilters.className, 'prediction-score-filters');
const outcomeRecord = JSON.stringify(f.run('predictionResult'));

f.click('predictionClearAll');
assert.equal(f.ids.get('predictionSelectedChance').textContent, '0.0%');
assert.ok(f.document.querySelectorAll('#predictionTableBody input').every((box) => !box.checked));
assert.equal(f.ids.get('animatePrediction').disabled, true);
f.click('predictionShowAll');
assert.equal(f.ids.get('predictionSelectedChance').textContent, '100.0%');
assert.ok(f.document.querySelectorAll('#predictionTableBody input').every((box) => box.checked));
assert.equal(JSON.stringify(f.run('predictionResult')), outcomeRecord);
const alphas = [];

const context = new Proxy(
  {},
  {
    get: () => () => {},
    set: (
      target,
      key,
      value,
    ) => {
      if (key === 'globalAlpha') {
        alphas.push(value);
      }

      target[key] = value;

      return true;
    },
  },
);

f.ids.get('predictionCourt').getContext = () => context;

f.run(
  'predictionResult.outcomes=Array.from({length:1000},()=>structuredClone(pred' +
    'ictionResult.outcomes[0]));predictionResult.count=1000;drawPrediction()',
);

assert.ok(
  alphas.some((alpha) => Math.abs(alpha - 2 * (1 - Math.exp(-12 / 1000))) < 1e-9),
  'Sampled positions and routes use twice the original density-scaled opacity',
);

assert.equal(
  alphas.at(-1),
  1,
  'The intention remains opaque',
);

f.run(
  "element('predictionDialog').close();selectShootingEnd('foot');setup('open')" +
    ";switchShooter('black');discs=[createDisc(4,34,'black')];shotHistory=[snaps" +
    'hot()];lastShot=snapshot();lastShotUndone=true;update()',
);

const before = f.run('snapshot()');
const history = JSON.stringify(f.run('shotHistory'));
const last = JSON.stringify(f.run('lastShot'));

f.click('placeBlock');
chooseBlock(f, 'tampa-yellow');
const after = f.run('snapshot()');

assert.equal(after.discs.length, 2);
assert.deepEqual(after.discs[0], before.discs[0]);
for (const key of [
  'accuracy',
  'angle',
  'color',
  'launchY',
  'position',
  'shootingEnd',
  'speed',
]) {
  assert.deepEqual(after[key], before[key]);
}

assert.deepEqual(after.aimPoint, before.aimPoint);
assert.equal(JSON.stringify(f.run('shotHistory')), history);
assert.equal(JSON.stringify(f.run('lastShot')), last);
assert.equal(f.run('lastShotUndone'), true);
assert.equal(f.ids.get('setupDialog').open, false);
f.click('placeBlock');
chooseBlock(f, 'tampa-yellow');
assert.equal(f.run('discs.length'), 2);
assert.equal(f.ids.get('setupDialog').open, true);
assert.match(f.ids.get('blockStatus').textContent, /occupied/);

f.run(
  "element('setupDialog').close();setup('open');discs=Array.from({length:3},(_" +
    ",i)=>createDisc(1+i,34,'yellow'));update()",
);

f.click('placeBlock');
chooseBlock(f, 'tampa-yellow');
assert.equal(f.run('discs.length'), 3);
assert.match(f.ids.get('blockStatus').textContent, /reserved/);
for (const end of ['head', 'foot']) {
  const c = createFixture();

  c.run("selectShootingEnd('" + end + "');setup('open');discs=[createDisc(4,34,'black')];update()");

  pointer(
    c,
    'target',
    'pointerdown',
    4,
    34,
  );

  pointer(
    c,
    'target',
    'pointermove',
    1,
    39.375,
  );

  assert.equal(c.run('discs[0].out'), true);

  assert.ok(
    Math.abs(c.run('discs[0].x') - 1) < 1e-8,
    'Held biscuit follows the pointer before parking',
  );

  pointer(
    c,
    'target',
    'pointerup',
    1,
    39.375,
  );

  assert.equal(c.run('discs.length'), 1);
  assert.equal(c.run('discs[0].parked'), true);
  assert.equal(c.run('physics.remainingBiscuits(discs,"black")'), 3);
  const parked = c.run('discs[0]');

  pointer(
    c,
    'target',
    'pointerdown',
    parked.x,
    parked.y,
  );

  pointer(
    c,
    'target',
    'pointermove',
    2,
    35,
  );

  pointer(
    c,
    'target',
    'pointerup',
    2,
    35,
  );

  assert.equal(c.run('discs[0].out'), false);
  assert.ok(Math.abs(c.run('discs[0].y') - 35) < 1e-8);
  c.run("setup('open')");
  const button = c.ids.get('supply0');

  c.dispatch(
    button,
    'pointerdown',
    { pointerId: 42 },
  );

  c.dispatch(
    button,
    'pointermove',
    c.pointEvent(
      'target',
      4,
      39.375,
      { pointerId: 42 },
    ),
  );

  c.dispatch(
    button,
    'pointerup',
    c.pointEvent(
      'target',
      4,
      39.375,
      { pointerId: 42 },
    ),
  );

  assert.equal(c.run('discs.length'), 1);
  assert.equal(c.run('discs[0].out'), true);
  assert.equal(c.run('discs[0].parked'), true);
  assert.equal(c.run('physics.score(discs[0])'), 0);
}

console.log(
  'PASS: four adjustment rows, labeled one-click views, outcome filter order, ' +
    'density-scaled opacity, additive blocks, and collection drop/return for both ends.',
);
