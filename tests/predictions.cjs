const assert = require('node:assert/strict');
const model = require('../scripts/prediction-model.js');
const persistence = require('../scripts/prediction-storage.js');
const physics = require('../scripts/physics.js');
const replay = require('../scripts/prediction-replay.js');
const { createFixture } = require('./dom-fixture.cjs');

function completed(state = makeState(), count = 1) {
  const record = model.prepare(state);

  for (let index = 0; index < count; index++) {
    record.outcomes.push(model.trial(record, () => 0.25));
  }

  record.count = count;

  return record;
}

async function main() {
  assert.equal(model.deterministic(makeState()), true);
  assert.equal(model.deterministic(makeState({ speed: 18 })), false);
  assert.equal(model.deterministic(makeState({ accuracy: 99.9 })), false);

  assert.equal(
    model.deterministic(
      makeState({
        court: {
          drift: 0,
          enabled: false,
          slick: 50,
          threshold: 8,
        },
        speed: 18,
      }),
    ),
    true,
  );

  const exact = model.prepare(makeState());

  model.trial(exact, () => {
    throw new Error('Deterministic shots must not sample');
  });

  for (const end of ['head', 'foot']) {
    const state = makeState({
      accuracy: 95,
      discs: [
        {
          color: 'black',
          id: 'b1',
          out: false,
          vx: 0,
          vy: 0,
          x: 4,
          y: 33,
        },
      ],
      shootingEnd: end,
      speed: 9,
    });

    const unchanged = JSON.stringify(state);
    const record = model.prepare(state);
    const outcome = model.trial(record, () => 0.25);

    assert.equal(
      JSON.stringify(state),
      unchanged,
      'Prediction leaves source state untouched',
    );

    const start = physics.startingPoint(
      state.color,
      state.position,
      state.launchY,
    );

    const [angle, speed] = outcome.launch;

    const expectedSpeed = physics.applyAccuracy(
      state.speed,
      state.accuracy,
      () => 0.25,
    );

    assert.equal(speed, expectedSpeed);

    const expectedAngle = physics.sampleAim(
      state.angle,
      state.accuracy,
      expectedSpeed,
      Math.hypot(state.aimPoint.x - start.x, state.aimPoint.y - start.y),
      () => 0.25,
      state.court,
    );

    assert.equal(
      angle,
      expectedAngle,
      'Angular variation uses sampled speed',
    );

    const radians = (angle * Math.PI) / 180;

    const simulated = physics.simulate(
      [
        ...state.discs,
        {
          ...start,
          color: state.color,
          out: false,
          vx: Math.sin(radians) * speed,
          vy: Math.cos(radians) * speed,
        },
      ],
      physics.deceleration(state.court.slick),
      0,
    );

    for (const disc of simulated.discs) {
      if (!disc.out && disc.y + physics.R < 25.5 - physics.LINE / 2) {
        disc.out = true;
      }
    }

    physics.collectOffCourt(simulated.discs);

    assert.deepEqual(
      outcome.positions,
      simulated.discs.map((disc) => {
        const point = model.physical(disc, end);

        return [
          point.x,
          point.y,
          disc.out ? 1 : 0,
        ];
      }),
      'Prediction reuses real physics and collection rules',
    );

    assert.equal(record.biscuits[0].y, end === 'head' ? 33 : 6);

    assert.deepEqual(
      record.biscuits.map((disc) => disc.label),
      ['B1', 'Y1'],
    );
  }

  for (const shootingEnd of ['head', 'foot']) {
    const replayRecord = completed(
      makeState({
        accuracy: 80,
        shootingEnd,
        speed: 9,
      }),
    );

    const outcome = replayRecord.outcomes[0];
    const motion = replay.build(replayRecord, outcome);
    const initial = replay.positions(motion, 0);
    const final = replay.positions(motion, motion.duration + 1);
    const middle = replay.positions(motion, motion.duration / 2);

    assert.ok(motion.frames instanceof Float32Array);
    assert.equal(motion.frames.byteLength % (replayRecord.biscuits.length * 12), 0);
    for (let index = 0; index < final.length; index++) {
      assert.ok(Math.abs(initial[index][0] - replayRecord.biscuits[index].x) < 0.00001);
      assert.ok(Math.abs(initial[index][1] - replayRecord.biscuits[index].y) < 0.00001);
      assert.ok(Math.abs(final[index][0] - outcome.ends[index][0]) < 0.00001);
      assert.ok(Math.abs(final[index][1] - outcome.ends[index][1]) < 0.00001);
      assert.equal(final[index][2], outcome.ends[index][2]);
    }

    assert.notDeepEqual(
      middle,
      final,
      'Playback includes real intermediate physics positions',
    );
  }

  const short = completed(makeState({ speed: 1 }));

  assert.equal(short.outcomes[0].positions[0][2], 1);
  assert.deepEqual(short.outcomes[0].score, [0, 0]);

  assert.ok(
    short.outcomes[0].ends[0][1] < 25.5,
    'Lines end at actual stops, not collected parking slots',
  );

  assert.ok(short.outcomes[0].positions[0][1] > 39);

  assert.ok(
    model.points(model.summarize(short))[0].end[1] < 25.5,
    'Compact saves retain displacement endpoints',
  );

  assert.throws(
    () =>
      model.prepare(
        makeState({
          discs: Array.from({ length: 4 }, () => ({
            color: 'yellow',
            out: true,
            vx: 0,
            vy: 0,
            x: 4,
            y: 33,
          })),
        }),
      ),
    /four/,
  );

  console.log(
    'PASS: prediction sampling, deterministic shots, shared physics, collection,' +
      ' inventory, and physical coordinates.',
  );

  const record = completed(makeState(), 100);
  const compact = model.summarize(record);

  assert.deepEqual(model.groups(compact), model.groups(record));

  assert.equal(
    model.points(compact).reduce((sum, point) => sum + point.count, 0),
    100,
  );

  assert.ok(persistence.bytes(compact) < persistence.bytes(record));
  assert.ok(persistence.validRecord(record));
  assert.ok(persistence.validRecord(compact));
  const store = memory();

  const saved = persistence.save(
    store,
    record,
    '',
  );

  assert.equal(saved.name, model.suggestedName(record));
  assert.equal(saved.record.storage, undefined);
  assert.deepEqual(persistence.read(store)[0].record, record);

  persistence.rename(
    store,
    saved.id,
    '<b>My shot</b>',
  );

  assert.equal(persistence.read(store)[0].name, '<b>My shot</b>');
  persistence.remove(store, saved.id);
  assert.equal(persistence.read(store).length, 0);
  for (let index = 0; index < 25; index++) {
    persistence.save(
      store,
      record,
      `Shot ${index}`,
    );
  }

  assert.equal(persistence.read(store).length, 25);

  assert.throws(
    () =>
      persistence.save(
        store,
        record,
        '',
      ),
    /25 saved/,
  );

  assert.equal(persistence.read(store).length, 25);
  const quota = memory(persistence.bytes(compact) + 500);

  assert.equal(
    persistence.save(
      quota,
      record,
      '',
    ).record.storage,
    'summary',
  );

  const large = structuredClone(record);

  large.outcomes[0].trace = 'x'.repeat(510 * 1024);

  assert.equal(
    persistence.save(
      memory(),
      large,
      '',
    ).record.storage,
    'summary',
  );

  const unavailable = {
    getItem: () => null,
    setItem() {
      throw new Error('Unavailable');
    },
  };

  assert.throws(
    () =>
      persistence.save(
        unavailable,
        record,
        '',
      ),
    /Nothing was saved|No saved shots were changed/,
  );

  const corrupt = {
    getItem: () => '{bad',
    setItem() {
      throw new Error('Must not overwrite');
    },
  };

  assert.throws(
    () =>
      persistence.save(
        corrupt,
        record,
        '',
      ),
    /left untouched/,
  );

  assert.equal(persistence.validRecord({ ...record, count: 1001 }), false);

  const combinationState = {
    accuracy: 95,
    aimPoint: {
      x: 1.4728778278536845,
      y: 36,
    },
    angle: -1.5536051196061467,
    color: 'black',
    court: {
      drift: 0,
      enabled: true,
      slick: 50,
      threshold: 8,
    },
    discs: [
      {
        color: 'black',
        id: 'blocker',
        out: false,
        vx: 0,
        vy: 0,
        x: 1.5,
        y: 35,
      },
      {
        color: 'yellow',
        id: 'target',
        out: false,
        vx: 0,
        vy: 0,
        x: 1.4728778278536845,
        y: 36,
      },
    ],
    launchY: 1.18,
    paths: [],
    position: 12,
    shootingEnd: 'head',
    speed: 7.559999999999997 * Math.sqrt(physics.deceleration(50) / 0.795),
  };

  for (const shootingEnd of ['head', 'foot']) {
    const combination = model.prepare({ ...combinationState, shootingEnd });

    assert.deepEqual(combination.intended.score, [-10, 7]);
    assert.equal(model.suggestedName(combination), 'Black 2: replace & kitchen Yellow 7 via B1');
    assert.deepEqual(model.summarize(combination).intended, combination.intended);
  }

  const drawTarget = { x: 4, y: 33.5 };

  const drawStart = physics.startingPoint(
    'yellow',
    12,
    1.18,
  );

  const draw = model.prepare(
    makeState({
      aimPoint: drawTarget,
      ...physics.targetShot(
        drawStart,
        drawTarget,
        physics.deceleration(50),
      ),
      discs: [
        {
          color: 'black',
          id: 'short',
          out: false,
          vx: 0,
          vy: 0,
          x: 0.5,
          y: 2,
        },
      ],
    }),
  );

  assert.match(
    model.suggestedName(draw),
    /draw to 8/,
    'Automatic collection of a stationary short biscuit is not a clearing intention',
  );

  const legacy = model.prepare(combinationState);

  delete legacy.intended;

  assert.deepEqual(
    model.intended(legacy).score,
    [-10, 7],
    'Old saves regenerate their perfect-shot intention',
  );

  const hard = model.prepare({
    ...combinationState,
    accuracy: 0,
    speed: 18,
  });

  assert.equal(hard.intended.launch[0], combinationState.angle);

  assert.equal(
    hard.intended.launch[1],
    18,
    'Intent ignores both accuracy errors and the hard-shot handicap',
  );

  console.log(
    'PASS: full/summary persistence, exact score totals, size/quota fallback, 25' +
      '-shot cap, rename/delete, and target-based names.',
  );

  const html = require('node:fs').readFileSync(require.resolve('../index.html'), 'utf8');
  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(
    new Set(htmlIds).size,
    htmlIds.length,
    'UI elements must have unique IDs',
  );

  const fixture = createFixture();

  const {
    run,
    ids,
    click,
    dispatch,
  } = fixture;

  assert.equal(ids.get('predictionDeltaScore').getAttribute('aria-pressed'), 'true');
  click('predictionFinalScore');

  function selectOutcome(index, checked = true) {
    const row = ids.get('predictionTableBody').children[index];
    const checkbox = row.children[4].children[0].children[0];

    checkbox.checked = checked;
    checkbox.onchange();

    return checkbox;
  }

  run(
    "element('accuracy').value='100';element('predictionAccuracy').value='100';e" +
      "lement('fastShotInaccuracy').checked=false;update()",
  );

  const before = JSON.stringify(run('snapshot()'));

  run("element('predictionDialog').showModal()");
  await run('generatePrediction()');
  assert.equal(run('predictionResult.count'), 1);
  assert.equal(JSON.stringify(run('snapshot()')), before);
  assert.equal(ids.get('savePrediction').disabled, false);
  click('savePrediction');
  assert.equal(run('PredictionStorage.read(localStorage).length'), 1);
  const savedRow = ids.get('savedPredictionList').children[0];
  const savedName = savedRow.children[0].children[0];

  assert.equal(ids.get('savedPredictions').open, true);
  assert.equal(fixture.document.activeElement, savedName);
  assert.equal(savedName.selected, true);

  assert.equal(
    savedRow.scrolledIntoView,
    true,
    'Saving reveals the new entry for immediate renaming',
  );

  savedName.value = 'Renamed test shot';

  dispatch(
    savedName,
    'keydown',
    { key: 'Enter' },
  );

  savedRow.children[2].children[0].onclick();
  assert.equal(ids.get('predictionName').value, 'Renamed test shot');

  assert.equal(
    ids.get('savedPredictions').open,
    false,
    'Loading closes only the drawer',
  );

  assert.equal(ids.get('predictionDialog').open, true);
  ids.get('predictionBody').scrollTop = 123;
  click('openSavedPredictions');
  assert.equal(ids.get('savedPredictions').open, true);
  run("element('savedPredictions').close()");

  assert.equal(
    ids.get('predictionBody').scrollTop,
    123,
    'Drawer access does not move prediction content',
  );

  assert.equal(fixture.document.activeElement, ids.get('openSavedPredictions'));
  assert.equal(ids.get('predictionTableBody').children.length, 1);
  const toggle = ids.get('predictionBiscuits').children[0].children[0];

  toggle.checked = false;
  toggle.onchange();
  assert.equal(run('predictionVisible.size'), 0);

  assert.equal(
    ids.get('predictionTableBody').children.length,
    1,
    'Visibility never changes score distribution',
  );

  run("element('predictionDialog').close();nudge(0.05)");

  assert.equal(
    run('predictionResult'),
    null,
    'Settings edits invalidate results',
  );

  run(
    "element('predictionDialog').showModal();loadPrediction(PredictionStorage.re" +
      'ad(localStorage)[0].record)',
  );

  assert.equal(JSON.stringify(run('snapshot()')), before);
  assert.equal(run('predictionResult.count'), 1);
  assert.equal(run('shotHistory.length'), 0);

  run(
    'predictionResult.beforeScore=[7,8];predictionResult.intended.score=[7,15];' +
      ('predictionResult.outcomes=Array.from({length:4},()=>structuredClone(predict' +
        'ionResult.outcomes[0]));') +
      'predictionResult.count=4;predictionResult.outcomes[0].score=[7,15];' +
      'predictionResult.outcomes[1].score=[15,8];predictionResult.outcomes[2].score=[15,8];' +
      'predictionResult.outcomes[3].score=[7,8];renderPredictionTable();drawPrediction()',
  );

  let rows = ids.get('predictionTableBody').children;

  assert.equal(rows.length, 3);
  assert.equal(rows[0].dataset.intended, 'true');
  assert.equal(rows[0].children[0].textContent, '7');

  assert.equal(
    rows[0].children[1].textContent,
    '15',
    'Default scores retain prior biscuits',
  );

  assert.equal(rows[0].children[3].textContent, '25.0%');
  assert.equal(rows[1].children[3].textContent, '50.0%');
  assert.equal(rows[2].children[3].textContent, '25.0%');

  assert.equal(
    ids.get('predictionTableHead').children[0].children.length,
    5,
    'Includes Delta without a Trials column',
  );

  assert.equal(ids.get('predictionBeforeYellow').textContent, '7');
  assert.equal(ids.get('predictionBeforeBlack').textContent, '8');

  assert.equal(
    ids.get('predictionAfterYellow').textContent,
    '15',
    'Default after score uses the most likely outcome',
  );

  run("predictionFilter='';drawPrediction()");
  selectOutcome(0);
  assert.equal(ids.get('predictionAfterYellow').textContent, '7');

  assert.equal(
    ids.get('predictionAfterBlack').textContent,
    '15',
    'Selected outcome controls the after scoreboard',
  );

  selectOutcome(1);
  assert.equal(run("predictionFilter.split(';').length"), 2);
  assert.match(ids.get('predictionMapSummary').textContent, /3 of 4 trials selected/);
  assert.equal(ids.get('predictionAfterYellow').textContent, '15');
  assert.match(ids.get('predictionAfterLabel').textContent, /most likely selected/);
  selectOutcome(1, false);
  assert.equal(ids.get('predictionAfterYellow').textContent, '7');
  assert.ok(ids.get('predictionCourt').title.includes('Collected'));
  assert.ok(ids.get('predictionMapSummary').classList.contains('sr-only'));
  click('predictionDeltaScore');
  rows = ids.get('predictionTableBody').children;
  assert.equal(rows[0].children[0].textContent, '—');
  assert.equal(rows[0].children[1].textContent, '+7');
  assert.ok(rows[0].children[1].classList.contains('score-positive'));
  assert.ok(rows[1].children[0].classList.contains('score-positive'));

  assert.equal(
    rows.length,
    3,
    'Per-player deltas never merge equal net advantages',
  );

  run('predictionResult.intended.score=[-10,7];renderPredictionTable()');
  rows = ids.get('predictionTableBody').children;

  assert.equal(
    rows[0].children[3].textContent,
    '0.0%',
    'Unobserved intended outcome is still shown first',
  );

  assert.ok(rows[0].children[0].classList.contains('score-negative'));
  assert.ok(rows[0].children[1].classList.contains('score-negative'));
  run("predictionResult.state.color='black';renderPredictionTable()");
  rows = ids.get('predictionTableBody').children;
  assert.ok(rows[0].children[0].classList.contains('score-negative'));
  assert.ok(rows[0].children[1].classList.contains('score-negative'));
  run("predictionResult.state.color='yellow'");
  run("predictionFilter='';drawPrediction()");
  selectOutcome(0);
  assert.equal(ids.get('predictionAfterYellow').textContent, '-10');
  assert.match(ids.get('predictionMapSummary').textContent, /0 of 4 trials selected/);
  run('loadPrediction(PredictionModel.summarize(PredictionStorage.read(localStorage)[0].record))');
  assert.equal(run('predictionResult.storage'), 'summary');

  assert.equal(
    JSON.stringify(run('snapshot()')),
    before,
    'Compact saves restore the full starting setup',
  );

  const retained = run('predictionResult');
  const unchangedBoard = JSON.stringify(run('snapshot()'));

  ids.get('predictionAccuracy').value = '80.0';
  dispatch(ids.get('predictionAccuracy'), 'input');

  assert.equal(
    run('accuracy()'),
    100,
    'Draft accuracy stays local until regeneration',
  );

  assert.equal(
    run('predictionResult'),
    retained,
    'Editing retains the existing results',
  );

  assert.equal(JSON.stringify(run('snapshot()')), unchangedBoard);
  assert.equal(ids.get('predictionResults').hidden, false);
  assert.equal(ids.get('predictionSyncMessage').hidden, false);
  assert.ok(ids.get('regeneratePrediction').classList.contains('prediction-out-of-sync'));

  assert.equal(
    ids.get('savePrediction').disabled,
    true,
    'Stale results cannot be saved under draft accuracy',
  );

  run("element('predictionDialog').close()");

  assert.equal(
    ids.get('predictionDialog').open,
    false,
    'A dirty accuracy field does not trap the dialog',
  );

  click('predictOutcomes');

  assert.equal(
    ids.get('predictionAccuracy').value,
    '80.0',
    'Reopening preserves the draft',
  );

  await run('generatePrediction()');
  assert.equal(run('predictionResult.state.accuracy'), 80);
  assert.equal(run('accuracy()'), 80);
  assert.equal(ids.get('predictionSyncMessage').hidden, true);
  assert.equal(ids.get('regeneratePrediction').classList.contains('prediction-out-of-sync'), false);
  assert.equal(ids.get('predictionTableHead').children[0].children[0].dataset.shooter, 'yellow');
  click('predictionScoringEnd');
  const beforeAnimation = JSON.stringify(run('predictionResult'));
  const pendingAnimation = run('PredictionAnimation.play()');

  run("element('predictionDialog').close()");
  await pendingAnimation;

  assert.equal(
    ids.get('animatePrediction').getAttribute('aria-pressed'),
    'false',
    'Closing cancels preparation before playback can restart',
  );

  run("element('predictionDialog').showModal()");
  click('predictionScoringEnd');
  await run('PredictionAnimation.play()');

  assert.equal(
    run('predictionCourtView'),
    'receiving',
    'Playback preserves the chosen court view',
  );

  assert.equal(ids.get('animatePrediction').getAttribute('aria-pressed'), 'true');
  run("predictionFilter='';drawPrediction()");

  assert.equal(
    ids.get('animatePrediction').disabled,
    false,
    'Stop remains available with no selected trials',
  );

  run("predictionFilter='*';drawPrediction()");

  assert.equal(
    run('PredictionAnimation.points(predictionResult, "*").length'),
    run('predictionResult.count * predictionResult.biscuits.length'),
    'Every trial starts on the same clock',
  );

  click('predictionFullCourt');
  run("element('predictionDialog').close()");

  assert.equal(
    run('predictionCourtView'),
    'full',
    'Stopping also preserves view changes',
  );

  assert.equal(ids.get('animatePrediction').getAttribute('aria-pressed'), 'false');

  assert.equal(
    JSON.stringify(run('predictionResult')),
    beforeAnimation,
    'Animation never alters sampled outcomes',
  );

  run(
    "element('predictionDialog').showModal();predictionResult.intended.score=[-10,7];" +
      "predictionFilter='-10,7|0';renderPredictionTable();drawPrediction()",
  );

  assert.ok(ids.get('predictionAfterYellow').classList.contains('negative-score'));
  run("discs=[createDisc(1.5,38.2,'yellow')];scores()");
  assert.ok(ids.get('yellowScore').classList.contains('negative-score'));
  run('discs=[];scores()');
  assert.equal(ids.get('yellowScore').classList.contains('negative-score'), false);
  ids.get('predictionAccuracy').value = '75.0';
  const committedAccuracy = run('accuracy()');
  const generation = run('generatePrediction()');

  run("element('predictionDialog').close()");
  await generation;
  assert.equal(run('predictionBusy'), false);

  assert.equal(
    run('accuracy()'),
    committedAccuracy,
    'Canceled regeneration does not commit a draft',
  );

  assert.equal(ids.get('predictionDialog').open, false);

  console.log(
    'PASS: real handlers generate without board mutation, filter visibility, sav' +
      'e/load, invalidate, change score mode, and cancel.',
  );
}

function makeState(overrides = {}) {
  return {
    accuracy: 100,
    aimPoint: { x: 4, y: 34 },
    angle: 0,
    color: 'yellow',
    court: {
      drift: 0,
      enabled: true,
      slick: 50,
      threshold: 8,
    },
    discs: [],
    launchY: 1.18,
    paths: [],
    position: 12,
    shootingEnd: 'head',
    speed: 7,
    ...overrides,
  };
}

function memory(limit = Infinity) {
  const items = new Map();

  return {
    getItem: (key) => items.get(key) ?? null,
    setItem(key, value) {
      if (value.length > limit) {
        throw new Error('Quota exceeded');
      }

      items.set(key, value);
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
