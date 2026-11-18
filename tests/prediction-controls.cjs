const assert = require('node:assert/strict');
const { createFixture } = require('./dom-fixture.cjs');
const model = require('../scripts/prediction-model.js');

function loaded() {
  const f = createFixture();

  f.run("element('accuracy').value='100';element('fastShotInaccuracy').checked=false;update()");
  const record = model.prepare(f.run('snapshot()'));
  const outcome = model.trial(record);

  record.outcomes = [
    { ...structuredClone(outcome), score: [1, 0] },
    { ...structuredClone(outcome), score: [7, 0] },
    { ...structuredClone(outcome), score: [7, 0] },
    { ...structuredClone(outcome), score: [-10, 0] },
    { ...structuredClone(outcome), score: [0, 8] },
  ];

  record.count = 5;
  f.context.saved = record;
  f.run("element('predictionDialog').showModal();loadPrediction(saved)");

  return f;
}

async function main() {
  verifyFirstSavedShotLoad();
  for (const end of ['head', 'foot']) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const f = createFixture();

      f.run("selectShootingEnd('" + end + "');focusRotation=" + rotation + ';draw()');
      const before = JSON.stringify(f.run('snapshot()'));

      const pointer = (type, y) =>
        f.dispatch(
          f.ids.get('target'),
          type,
          f.pointEvent(
            'target',
            4.5,
            y,
            { pointerId: 17 },
          ),
        );

      pointer('pointerdown', 36);
      pointer('pointermove', 39);
      const atEnd = f.run("value('speed')");

      pointer('pointermove', 44);
      assert.ok(f.run("value('speed')") > atEnd);
      assert.ok(Math.abs(f.run('aimPoint.y') - 44) < 1e-8);
      pointer('pointerup', 46);
      assert.ok(Math.abs(f.run('aimPoint.y') - 46) < 1e-8);
      pointer('pointerdown', 35);
      pointer('pointermove', 44);
      pointer('pointercancel', 44);
      assert.ok(Math.abs(f.run('aimPoint.y') - 46) < 1e-8);
      assert.notEqual(JSON.stringify(f.run('snapshot()')), before);
    }
  }

  const f = loaded();
  const initial = JSON.stringify(f.run('predictionPendingState()'));
  const results = JSON.stringify(f.run('predictionResult'));
  const live = JSON.stringify(f.run('snapshot()'));
  const open = () => f.click('openPredictionControls');

  open();
  f.ids.get('settingsSpeed').value = '20';
  f.click('closePredictionControls');
  assert.equal(JSON.stringify(f.run('predictionPendingState()')), initial);
  open();
  f.ids.get('settingsAccuracy').value = '81.2';
  f.click('resetPredictionControls');
  assert.equal(f.ids.get('settingsAccuracy').value, '100.0');
  f.ids.get('settingsAim').value = '5';
  f.click('closePredictionControlsX');
  assert.equal(JSON.stringify(f.run('predictionPendingState()')), initial);
  open();
  f.ids.get('settingsSpeed').value = '20';
  f.ids.get('settingsAim').value = '2';
  f.ids.get('settingsSlick').value = '40';
  f.ids.get('settingsDrift').value = '4';
  f.ids.get('settingsAccuracy').value = '81.2';
  f.click('savePredictionControls');
  assert.equal(f.run('predictionPendingState().speed'), 20);
  assert.equal(f.run('predictionPendingState().angle'), 2);
  assert.equal(f.run('predictionPendingState().court.slick'), 40);
  assert.equal(f.run('predictionPendingState().court.drift'), 4);
  assert.equal(f.run('predictionPendingState().accuracy'), 81.2);
  assert.equal(f.run('predictionPendingState().aimPoint'), null);
  assert.equal(JSON.stringify(f.run('predictionResult')), results);
  assert.equal(JSON.stringify(f.run('snapshot()')), live);
  assert.equal(f.run('predictionAccuracyOutOfSync()'), true);
  assert.ok(f.ids.get('regeneratePrediction').classList.contains('prediction-out-of-sync'));
  assert.equal(f.ids.get('predictionSettingsValues').children.length, 10);
  open();

  f.dispatch(
    f.ids.get('predictionControls'),
    'keydown',
    { key: 'Escape' },
  );

  assert.equal(f.ids.get('predictionControls').hidden, true);
  assert.equal(f.ids.get('predictionDialog').open, true);
  await f.run('generatePrediction()');
  assert.equal(f.run('predictionResult.state.speed'), 20);
  assert.equal(f.run('predictionResult.state.court.drift'), 4);
  assert.equal(f.run('predictionAccuracyOutOfSync()'), false);
  const sorting = loaded();
  const source = JSON.stringify(sorting.run('predictionResult'));
  const selected = sorting.run('predictionFilter');

  const scores = () =>
    sorting.ids
      .get('predictionTableBody')
      .children.slice(1)
      .map((row) => row.dataset.score);

  const sort = (column) =>
    sorting.ids.get('predictionTableHead').children[0].children[column].children[0].onclick();

  sort(0);

  assert.deepEqual(scores(), [
    '7,0',
    '1,0',
    '0,8',
    '-10,0',
  ]);

  assert.equal(
    sorting.ids.get('predictionTableHead').children[0].children[0].getAttribute('aria-sort'),
    'descending',
  );

  sort(0);

  assert.deepEqual(scores(), [
    '-10,0',
    '0,8',
    '1,0',
    '7,0',
  ]);

  sort(1);
  assert.equal(scores()[0], '0,8');
  sort(2);
  assert.equal(scores()[0], '-10,0');
  sort(3);
  assert.equal(scores()[0], '7,0');
  assert.equal(sorting.run('predictionFilter'), selected);
  assert.equal(JSON.stringify(sorting.run('predictionResult')), source);
  sorting.click('predictionClearAll');
  sort(4);

  const row = sorting.ids
    .get('predictionTableBody')
    .children.find((row) => row.dataset.score === '1,0');

  row.children[4].children[1].onclick();
  assert.equal(scores()[0], '1,0');
  sorting.ids.get('savedPredictionList').scrollTop = 600;
  sorting.click('openSavedPredictions');
  assert.equal(sorting.ids.get('savedPredictionList').scrollTop, 0);

  console.log(
    'PASS: off-court target power, transactional five-setting prediction control' +
      's, table sorting, and saved drawer top.',
  );
}

function verifyFirstSavedShotLoad() {
  const source = loaded().run('predictionResult');

  for (const record of [source, model.summarize(source)]) {
    const records = [
      {
        id: 'first-after-reload',
        name: 'First saved shot',
        record,
      },
    ];

    const f = createFixture({ storage: { 'shotLab.predictions.v1': JSON.stringify(records) } });
    const canvas = f.ids.get('predictionCourt');
    const bounds = canvas.getBoundingClientRect.bind(canvas);

    canvas.getBoundingClientRect = () =>
      f.ids.get('predictionResults').hidden
        ? {
            bottom: 0,
            height: 0,
            left: 0,
            right: 0,
            top: 0,
            width: 0,
          }
        : bounds();

    assert.equal(f.run('viewMaps.predictionCourt'), undefined);
    f.click('savedShots');

    const load = f.document
      .querySelectorAll('#savedPredictionList button')
      .find((button) => button.getAttribute('aria-label') === 'Load shot');

    assert.ok(load);
    load.onclick();
    assert.equal(f.ids.get('savedPredictions').open, false);
    assert.equal(f.ids.get('predictionResults').hidden, false);

    assert.equal(
      f.ids.get('predictionName').value,
      model.namedWithAccuracy('First saved shot', record.state.accuracy),
    );

    assert.ok(f.run('viewMaps.predictionCourt'));
    assert.equal(f.run('predictionResult.count'), record.count);
    f.ids.get('predictionControls').hidden = true;
    f.ids.get('predictionResults').hidden = true;
    delete f.run('viewMaps').predictionCourt;
    assert.doesNotThrow(() => f.run('drawPrediction()'));
    f.ids.get('predictionResults').hidden = false;
    f.run('drawPrediction()');
    assert.ok(f.run('viewMaps.predictionCourt'));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
