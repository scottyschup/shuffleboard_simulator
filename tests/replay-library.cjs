const assert = require('node:assert/strict');
const model = require('../scripts/prediction-model.js');
const storage = require('../scripts/prediction-storage.js');
const physics = require('../scripts/physics.js');
const { createFixture } = require('./dom-fixture.cjs');

function load(fixture, data) {
  fixture.context.saved = data;
  fixture.run("element('predictionDialog').showModal();loadPrediction(saved)");
}

async function main() {
  const data = record();

  verifyAccuracyAndLayers(data);
  verifyScoringEntry();
  verifyDeliveryTiming();

  const library = Array.from({ length: 25 }, (_, index) => ({
    id: 'test-' + index,
    name: 'Shot ' + index,
    record: structuredClone(data),
  }));

  const json = storage.exportRecords(library);
  const imported = memory();

  assert.equal(storage.limit, 25);
  assert.equal(storage.importRecords(imported, json).imported, 25);
  assert.equal(storage.importRecords(imported, json).skipped, 25);
  assert.deepEqual(storage.read(imported), library);
  const before = imported.getItem('shotLab.predictions.v1');

  assert.throws(
    () =>
      storage.importRecords(
        imported,
        storage.exportRecords([
          {
            ...library[0],
            id: 'extra',
            name: 'Extra',
          },
        ]),
      ),
    /25-shot/,
  );

  assert.equal(imported.getItem('shotLab.predictions.v1'), before);
  assert.throws(() => storage.importRecords(imported, '{bad json'), /valid JSON/);
  const bad = structuredClone(library[0]);

  bad.record.biscuits[0].shooter = false;
  assert.throws(() => storage.importRecords(imported, JSON.stringify([bad])), /invalid/);
  assert.equal(imported.getItem('shotLab.predictions.v1'), before);
  const badPaths = structuredClone(library[0]);

  badPaths.record.state.paths = ['broken'];
  assert.throws(() => storage.importRecords(imported, JSON.stringify([badPaths])), /invalid/);
  const mixed = structuredClone(library[0]);

  mixed.record.summary = [];
  assert.throws(() => storage.importRecords(imported, JSON.stringify([mixed])), /invalid/);
  assert.equal(imported.getItem('shotLab.predictions.v1'), before);
  const conflict = memory();

  storage.importRecords(conflict, storage.exportRecords([library[0]]));
  const changed = { ...library[0], name: 'Different name' };

  assert.equal(storage.importRecords(conflict, storage.exportRecords([changed])).imported, 1);
  assert.equal(storage.read(conflict).length, 2);
  assert.equal(storage.read(conflict)[0].name, 'Shot 0');
  assert.notEqual(storage.read(conflict)[0].id, storage.read(conflict)[1].id);
  assert.equal(storage.importRecords(conflict, storage.exportRecords([changed])).skipped, 1);

  const compact = model.summarize(data),
    compactEntry = {
      id: 'compact',
      name: 'Compact',
      record: compact,
    };

  const compactStore = memory();

  storage.importRecords(compactStore, storage.exportRecords([compactEntry]));
  assert.deepEqual(storage.read(compactStore)[0].record, compact);
  const quota = memory();

  storage.importRecords(quota, storage.exportRecords([library[0]]));
  const quotaBefore = quota.getItem('shotLab.predictions.v1');

  quota.fail = true;

  assert.throws(
    () => storage.importRecords(quota, storage.exportRecords([library[1]])),
    /full|unavailable/,
  );

  assert.equal(quota.getItem('shotLab.predictions.v1'), quotaBefore);
  const f = createFixture();

  load(f, data);

  assert.equal(
    f.ids.get('predictionTableBody').children[0].children[4].children[0].children[1].textContent,
    '*',
  );

  const snapshot = JSON.stringify(f.run('predictionResult'));
  const baseScale = f.run('viewMaps.predictionCourt.scale');

  f.click('predictionZoomIn');
  assert.equal(f.ids.get('predictionZoomValue').textContent, '125%');
  assert.ok(Math.abs(f.run('viewMaps.predictionCourt.scale') - baseScale * 1.25) < 1e-8);
  f.ids.get('predictionZoom').value = '2';
  f.dispatch(f.ids.get('predictionZoom'), 'input');
  const point = f.run('viewMaps.predictionCourt.map(3,34)');

  f.dispatch(
    f.ids.get('predictionCourt'),
    'pointerdown',
    {
      clientX: 100,
      clientY: 100,
      pointerId: 9,
    },
  );

  f.dispatch(
    f.ids.get('predictionCourt'),
    'pointermove',
    {
      clientX: 160,
      clientY: 130,
      pointerId: 9,
    },
  );

  f.dispatch(
    f.ids.get('predictionCourt'),
    'pointerup',
    { pointerId: 9 },
  );

  const moved = f.run('viewMaps.predictionCourt.map(3,34)');

  assert.ok(Math.abs(moved[0] - point[0] - 60) < 1e-8);
  assert.ok(Math.abs(moved[1] - point[1] - 30) < 1e-8);
  const inverse = f.run('viewMaps.predictionCourt.unmap(...viewMaps.predictionCourt.map(3,34))');

  assert.ok(Math.abs(inverse.x - 3) < 1e-8 && Math.abs(inverse.y - 34) < 1e-8);
  f.click('predictionZoomReset');
  assert.equal(f.run('predictionViewport.zoom'), 1);
  assert.equal(f.run('predictionViewport.panX'), 0);
  await f.run('PredictionAnimation.play()');
  assert.equal(f.ids.get('predictionCourt').dataset.view, 'full');
  assert.equal(f.ids.get('animatePrediction').textContent, '⏸️');
  const replay = require('../scripts/prediction-replay.js');

  const entry = Math.min(
    ...data.outcomes.map((outcome) => replay.build(data, outcome).scoringEntry),
  );

  assert.ok(Number.isFinite(entry));
  f.run('PredictionAnimation.seek(' + (entry + 0.01) + ')');
  assert.equal(f.ids.get('predictionCourt').dataset.view, 'receiving');
  f.run('PredictionAnimation.seek(0)');
  assert.equal(f.ids.get('predictionCourt').dataset.view, 'full');
  await f.run('PredictionAnimation.play()');
  f.click('predictionScoringEnd');
  assert.equal(f.ids.get('predictionCourt').dataset.view, 'receiving');
  f.frame(0);
  f.frame(100);
  assert.equal(f.ids.get('predictionAnimationTime').textContent, '00.100');
  f.click('animatePrediction');
  f.frame(200);
  assert.equal(f.ids.get('predictionAnimationTime').textContent, '00.100');

  assert.ok(
    f.run('PredictionAnimation.points(predictionResult,"*")') !== null,
    'Pause keeps the current frame visible',
  );

  const duration = Number(f.ids.get('predictionReplaySeek').max),
    target = duration / 2;

  f.ids.get('predictionReplaySeek').value = String(target);
  f.dispatch(f.ids.get('predictionReplaySeek'), 'input');
  assert.ok(Math.abs(Number(f.ids.get('predictionReplaySeek').value) - target) < 1e-8);
  const paused = f.ids.get('predictionAnimationTime').textContent;

  f.frame(300);
  assert.equal(f.ids.get('predictionAnimationTime').textContent, paused);
  f.click('predictionReplayFaster');
  assert.equal(f.ids.get('predictionReplaySpeed').textContent, '2×');
  await f.run('PredictionAnimation.play()');
  f.frame(400);
  f.frame(500);
  assert.ok(Math.abs(Number(f.ids.get('predictionReplaySeek').value) - target - 0.2) < 1e-8);
  f.click('predictionReplaySlower');
  assert.equal(f.ids.get('predictionReplaySpeed').textContent, '1×');
  f.run('PredictionAnimation.seek(1000)');
  assert.ok(Math.abs(Number(f.ids.get('predictionReplaySeek').value) - duration) < 1e-8);
  await f.run('PredictionAnimation.play()');
  assert.equal(f.ids.get('predictionAnimationTime').textContent, '00.000');
  f.run('PredictionAnimation.pause();PredictionAnimation.setSpeed(100)');
  assert.equal(f.ids.get('predictionReplayFaster').disabled, true);
  f.run('PredictionAnimation.setSpeed(0.01)');
  assert.equal(f.ids.get('predictionReplaySlower').disabled, true);

  assert.equal(
    JSON.stringify(f.run('predictionResult')),
    snapshot,
    'Zoom, replay speed and seeking never change sampled data',
  );

  f.click('savePrediction');
  assert.equal(f.ids.get('savedPredictionCount').textContent, 'Saved shots (1/25)');
  let row = f.ids.get('savedPredictionList').children[0],
    name = row.children[0].children[0],
    pencil = row.children[0].children[1];

  assert.equal(
    name.readOnly,
    false,
    'New saves remain immediately editable',
  );

  assert.match(row.children[1].textContent, /KB JSON/);
  assert.equal(pencil.textContent, '✏️');
  name.value = 'My shot';

  f.dispatch(
    name,
    'keydown',
    { key: 'Enter' },
  );

  assert.equal(f.run('PredictionStorage.read(localStorage)[0].name'), 'My shot');
  assert.equal(name.readOnly, true);
  pencil.onclick();
  assert.equal(name.readOnly, false);
  name.value = 'Cancelled';

  f.dispatch(
    name,
    'keydown',
    { key: 'Escape' },
  );

  assert.equal(name.value, 'My shot');
  assert.equal(row.children[2].children[0].getAttribute('aria-label'), 'Load shot');
  assert.ok(row.children[2].children[2].classList.contains('saved-prediction-delete'));
  f.click('exportPredictions');
  const exported = JSON.parse(await f.document.lastDownload.blob.text());

  assert.equal(exported.shots[0].name, 'My shot');
  const destination = createFixture();

  destination.click('savedShots');
  destination.click('importPredictions');
  assert.equal(destination.ids.get('importPredictionFile').wasClicked, true);
  const field = destination.ids.get('importPredictionFile');

  field.files = [{ size: json.length, text: async () => json }];
  await field.onchange();
  assert.equal(destination.run('PredictionStorage.read(localStorage).length'), 25);
  assert.equal(field.value, '');
  assert.match(destination.ids.get('savedPredictionStatus').textContent, /Imported 25/);
  for (const end of ['head', 'foot']) {
    const court = createFixture();

    const calls = [],
      state = {};

    let points = [];

    const ctx = new Proxy(state, {
      get: (target, key) =>
        key in target
          ? target[key]
          : (...args) => {
              if (key === 'beginPath') {
                points = [];
              }

              if (key === 'moveTo' || key === 'lineTo') {
                points.push(args);
              }

              if (key === 'fill' && points.length >= 3) {
                calls.push({ fill: state.fillStyle, points: points.slice() });
              }

              if (key === 'fillText') {
                calls.push({ fill: state.fillStyle, text: args[0] });
              }
            },
      set: (
        target,
        key,
        value,
      ) => {
        target[key] = value;

        return true;
      },
    });

    court.ids.get('target').getContext = () => ctx;
    court.run("selectShootingEnd('" + end + "');focusRotation=0");
    calls.length = 0;
    court.run('draw()');
    const marker = end === 'head' ? '🦶' : '👤';

    assert.ok(calls.some((call) => call.text === marker));

    const colored = calls.filter(
      (call) => call.points && ['#202e29', '#edc559'].includes(call.fill),
    );

    assert.equal(
      colored.length,
      4,
      'Only two outer triangles per kitchen receive color',
    );

    assert.ok(
      colored.every((call) => call.points.length === 3),
      'No scoring parallelograms are colored',
    );

    assert.ok(calls.filter((call) => call.text === '−10').every((call) => call.fill === '#e3e8ce'));
    const receivingY = court.run('viewMaps.target.map(3,38)[1]');

    const fields = calls
      .filter(
        (call) =>
          call.points &&
          Math.abs(
            call.points.reduce((sum, p) => sum + p[1], 0) / call.points.length - receivingY,
          ) < 2,
      )
      .slice(-2);

    assert.equal(fields.length, 2);

    fields.sort(
      (a, b) =>
        a.points.reduce((sum, p) => sum + p[0], 0) - b.points.reduce((sum, p) => sum + p[0], 0),
    );

    assert.equal(fields[0].fill, end === 'head' ? '#202e29' : '#edc559');
    for (const field of fields) {
      const expected =
        field.fill === '#202e29'
          ? [
              [0, 37.5],
              [0.5, 37.5],
              [0, 39],
            ]
          : [
              [5.5, 37.5],
              [6, 37.5],
              [6, 39],
            ];

      field.points.forEach((point, index) => {
        const world = court.run('viewMaps.target.unmap(' + point[0] + ',' + point[1] + ')');

        assert.ok(
          Math.abs(world.x - expected[index][0]) < 1e-8 &&
            Math.abs(world.y - expected[index][1]) < 1e-8,
        );
      });
    }

    court.run("setup('open');discs=[createDisc(4,34,'black')];update()");

    const pointer = (
      type,
      x,
      y,
    ) =>
      court.dispatch(
        court.ids.get('target'),
        type,
        court.pointEvent(
          'target',
          x,
          y,
          { pointerId: 7 },
        ),
      );

    pointer(
      'pointerdown',
      4,
      34,
    );

    pointer(
      'pointermove',
      7,
      35,
    );

    pointer(
      'pointerup',
      7,
      35,
    );

    assert.equal(court.run('discs.length'), 1);
    assert.equal(court.run('discs[0].out'), true);
    const parked = court.run('discs[0]');

    pointer(
      'pointerdown',
      parked.x,
      parked.y,
    );

    const box = court.ids.get('supplyColumn').getBoundingClientRect();

    court.dispatch(
      court.ids.get('target'),
      'pointerup',
      {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        pointerId: 7,
      },
    );

    assert.equal(court.run('discs.length'), 0);
    assert.equal(court.run('supplyOrder().every((c,i,a)=>!i||c!==a[i-1])'), true);
  }

  const collected = Array.from({ length: 8 }, (_, index) => ({
    color: index < 4 ? 'black' : 'yellow',
    out: true,
  }));

  physics.collectOffCourt(collected);

  assert.ok(
    collected.filter((disc) => disc.color === 'black').every((disc) => disc.x + physics.R < 2.9),
  );

  assert.ok(
    collected.filter((disc) => disc.color === 'yellow').every((disc) => disc.x - physics.R > 3.1),
  );

  console.log(
    'PASS: 25-shot import/export, atomic quota handling, editable drawer icons, ' +
      'replay pause/seek/speed, zoom/pan, colored kitchens and collection/queue re' +
      'turns.',
  );
}

function memory() {
  const values = new Map();

  return {
    fail: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.fail) {
        throw new Error('Quota');
      }

      values.set(key, value);
    },
  };
}

function record() {
  const fixture = createFixture();
  const result = model.prepare(fixture.run('snapshot()'));

  result.outcomes = Array.from({ length: 3 }, () => model.trial(result, () => 0.25));
  result.count = 3;

  return result;
}

function verifyAccuracyAndLayers(data) {
  const f = createFixture();

  f.ids.get('accuracy').value = '83.7';
  f.dispatch(f.ids.get('accuracy'), 'change');
  const saved = f.run("localStorage.getItem('shotLab.accuracy')");

  assert.equal(JSON.parse(saved).value, 83.7);
  const restored = createFixture({ storage: { 'shotLab.accuracy': saved } });

  assert.equal(restored.ids.get('accuracyRestoreDialog').open, true);
  assert.equal(restored.ids.get('accuracyRestoreValue').textContent, '83.7%');
  restored.click('restoreSavedAccuracy');
  assert.equal(restored.run('accuracy()'), 83.7);
  assert.equal(restored.ids.get('accuracyRestoreDialog').open, false);
  const declined = createFixture({ storage: { 'shotLab.accuracy': saved } });
  const defaultAccuracy = declined.run('accuracy()');

  declined.click('useDefaultAccuracy');
  assert.equal(declined.run('accuracy()'), defaultAccuracy);
  assert.equal(declined.ids.get('accuracyRestoreDialog').open, false);
  const dismissed = createFixture({ storage: { 'shotLab.accuracy': saved } });

  dismissed.ids.get('accuracyRestoreDialog').close();
  assert.equal(dismissed.run('accuracy()'), defaultAccuracy);
  const malformed = createFixture({ storage: { 'shotLab.accuracy': '{bad' } });

  assert.equal(!!malformed.ids.get('accuracyRestoreDialog').open, false);
  f.click('accuracyUp');
  assert.equal(JSON.parse(f.run("localStorage.getItem('shotLab.accuracy')")).value, 83.8);
  load(f, data);
  assert.equal(JSON.parse(f.run("localStorage.getItem('shotLab.accuracy')")).value, 83.8);
  f.ids.get('predictionAccuracy').value = '72.4';
  f.dispatch(f.ids.get('predictionAccuracy'), 'input');
  assert.equal(JSON.parse(f.run("localStorage.getItem('shotLab.accuracy')")).value, 72.4);
  assert.equal(f.run('predictionResult.state.accuracy'), data.state.accuracy);
  assert.equal(f.run('predictionAccuracyOutOfSync()'), true);
  const before = JSON.stringify(f.run('predictionResult'));
  const calls = [];

  const ctx = new Proxy(
    {},
    {
      get: (target, key) => (key in target ? target[key] : (...args) => calls.push([key, ...args])),
    },
  );

  f.ids.get('predictionCourt').getContext = () => ctx;
  f.run('drawPrediction()');
  assert.ok(calls.some((call) => call[0] === 'setLineDash' && JSON.stringify(call[1]) === '[1,2]'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === data.biscuits[0].label));
  calls.length = 0;
  f.click('predictionToggleIntention');
  assert.equal(f.ids.get('predictionToggleIntention').textContent, 'Show Shot Intention');
  assert.equal(f.ids.get('predictionToggleIntention').getAttribute('aria-pressed'), 'false');

  assert.ok(
    !calls.some((call) => call[0] === 'setLineDash' && JSON.stringify(call[1]) === '[1,2]'),
  );

  calls.length = 0;
  f.click('predictionToggleStarts');
  assert.equal(f.ids.get('predictionToggleStarts').textContent, 'Show Starting Biscuits');
  assert.ok(!calls.some((call) => call[0] === 'fillText' && call[1] === data.biscuits[0].label));
  f.click('predictionToggleStarts');
  f.click('predictionToggleIntention');
  assert.equal(f.ids.get('predictionToggleIntention').textContent, 'Hide Shot Intention');
  assert.equal(f.ids.get('predictionSelectedChance').textContent, '100.0%');
  assert.equal(JSON.stringify(f.run('predictionResult')), before);
}

function verifyDeliveryTiming() {
  const replay = require('../scripts/prediction-replay.js');
  const fixture = createFixture();

  fixture.run(
    "element('accuracy').value='100';element('fastShotInaccuracy').checked=false;update()",
  );

  const current = model.prepare(fixture.run('snapshot()'));
  const outcome = model.trial(current);
  const track = replay.build(current, outcome);

  assert.ok(track.duration >= 3 && track.duration <= 6);
  fixture.click('shoot');
  for (let frame = 0; frame <= 400 && fixture.run('running'); frame++) {
    fixture.frame(1000 + (frame * 1000) / 60);
  }

  assert.ok(Math.abs(fixture.run('time') - track.duration) <= physics.DT * 2);
  const legacy = structuredClone(current);

  delete legacy.state.court.deceleration;
  legacy.state.speed = 7;
  const old = model.trial(legacy);
  const oldTrack = replay.build(legacy, old);
  const explicit = structuredClone(legacy);

  explicit.state.court.deceleration = 0.12 + 1.35 * (1 - explicit.state.court.slick / 100);
  const reference = replay.build(explicit, model.trial(explicit));

  assert.equal(oldTrack.duration, reference.duration);
  assert.deepEqual(oldTrack.frames, reference.frames);
  assert.ok(oldTrack.duration > track.duration);

  const entry = {
    id: 'timing',
    name: 'Timing',
    record: {
      ...current,
      count: 1,
      outcomes: [outcome],
    },
  };

  const destination = memory();

  storage.importRecords(destination, storage.exportRecords([entry]));

  assert.equal(
    storage.read(destination)[0].record.state.court.deceleration,
    current.state.court.deceleration,
  );
}

function verifyScoringEntry() {
  const replay = require('../scripts/prediction-replay.js');

  for (const shootingEnd of ['head', 'foot']) {
    const point = (y) => model.physical({ x: 3, y }, shootingEnd);
    const values = [];

    for (const y of [24, 25]) {
      const shooter = point(y),
        prior = point(34);

      values.push(
        prior.x,
        prior.y,
        0,
        shooter.x,
        shooter.y,
        0,
      );
    }

    const track = {
      duration: 1 / 15,
      frames: new Float32Array(values),
      stride: 6,
    };

    const data = { biscuits: [{ shooter: false }, { shooter: true }], state: { shootingEnd } };

    assert.ok(Math.abs(replay.scoringEntryTime(track, data) - 0.5 / 15) < 1e-8);
    const short = new Float32Array(values);

    short[10] = point(24.1).y;
    assert.equal(replay.scoringEntryTime({ ...track, frames: short }, data), Infinity);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
