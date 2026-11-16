/* exported
  drawPrediction,
  initializePredictions,
  syncPrediction
*/
'use strict';
let predictionResult = null;
let predictionFilter = '';
let predictionVisible = new Set();
let predictionGeneration = 0;
let predictionBusy = false;
let predictionSignature = '';

function changePredictionAccuracy(normalize = true) {
  const field = input('predictionAccuracy');

  if (normalize && field.value.trim() && Number.isFinite(Number(field.value))) {
    field.value = Math.max(0, Math.min(100, Number(field.value))).toFixed(1);
  }

  renderPredictionSync();
}

function drawPrediction() {
  const record = predictionResult;

  if (!record || !element('predictionDialog').open) {
    return;
  }

  const zoom = input('predictionCourtView').value !== 'full';

  element('predictionCourt').dataset.view = zoom ? 'receiving' : 'full';

  render(
    'predictionCourt',
    zoom,
    record,
  );

  const canvas = element('predictionCourt');
  const ctx = canvas.getContext('2d');
  const { map, scale } = viewMaps.predictionCourt;
  const keys = predictionFilter ? predictionFilter.split(';') : [];

  const mapPhysical = (x, y) => {
    const point = PredictionModel.physical({ x, y }, record.state.shootingEnd);

    return map(point.x, point.y);
  };

  const groups = PredictionModel.groups(record).filter(
    (group) => !keys.length || keys.includes(group.score.join(',')),
  );

  const count = groups.reduce((total, group) => total + group.count, 0);
  const animated = PredictionAnimation.points(record, predictionFilter);
  let points =
    animated ||
    PredictionModel.points(record).filter((point) => !keys.length || keys.includes(point.key));
  const nominalOnly = !!predictionFilter && count === 0;

  if (nominalOnly && !animated) {
    points = PredictionModel.intended(record).positions.map((position, biscuit) => ({
      biscuit,
      count: 1,
      end: PredictionModel.intended(record).ends?.[biscuit] || null,
      key: predictionFilter,
      position,
    }));
  }

  const collected = record.biscuits.map(() => 0);

  renderPredictionScoreboards();
  for (const point of points) {
    if (!predictionVisible.has(point.biscuit)) {
      continue;
    }

    const disc = record.biscuits[point.biscuit];
    const q = mapPhysical(point.position[0], point.position[1]);

    // Comparable density across 1, 100, and 1000 trials, including compact weighted bins.
    ctx.globalAlpha = Math.max(
      1 / 255,
      1 - Math.exp((-12 * point.count) / Math.max(1, nominalOnly ? 1 : count)),
    );

    ctx.fillStyle = disc.color === 'yellow' ? '#ffe06a' : '#101b27';
    const start = record.biscuits[point.biscuit];
    const end = point.end || (point.position[2] ? null : point.position);

    if (!start.out && end && Math.hypot(start.x - end[0], start.y - end[1]) > 0.05) {
      const origin = mapPhysical(start.x, start.y);

      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      const destination = mapPhysical(end[0], end[1]);

      ctx.lineTo(destination[0], destination[1]);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (point.position[2]) {
      collected[point.biscuit] += point.count;
      continue;
    }

    ctx.beginPath();

    ctx.arc(
      q[0],
      q[1],
      physics.R * scale,
      0,
      Math.PI * 2,
    );

    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (const [index, disc] of record.biscuits.entries()) {
    if (!predictionVisible.has(index) || disc.out) {
      continue;
    }

    const q = mapPhysical(disc.x, disc.y);

    ctx.beginPath();

    ctx.arc(
      q[0],
      q[1],
      physics.R * scale,
      0,
      Math.PI * 2,
    );

    ctx.strokeStyle = disc.color === 'yellow' ? '#fff2a6' : '#c4d9f0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      disc.label,
      q[0],
      q[1] - physics.R * scale - 5,
    );
  }

  const summaries = collected
    .map((amount, index) =>
      predictionVisible.has(index)
        ? `${record.biscuits[index].label}: ${((amount / Math.max(1, nominalOnly ? 1 : count)) * 100).toFixed(1)}%`
        : '',
    )
    .filter(Boolean);

  element('predictionCollected').textContent =
    (animated ? 'Collected so far: ' : 'Collected: ') +
    (summaries.join(' · ') || 'no visible biscuits') +
    '. Collected biscuits score zero.';

  element('predictionMapSummary').textContent =
    (nominalOnly
      ? `Intended result shown; 0 of ${record.count} sampled trials matched. `
      : `${count} of ${record.count} trials shown. `) +
    `${predictionVisible.size} of ${record.biscuits.length} biscuits visible. ` +
    ('Darker footprints mean more frequent final positions; dashed outlines show ' +
      (animated
        ? 'starting positions. All delivery variants share the same clock.'
        : 'starting positions. Straight lines connect start and finish; they are not collision paths.'));

  element('predictionCourtHelp').title =
    element('predictionMapSummary').textContent + ' ' + element('predictionCollected').textContent;
}

async function generatePrediction() {
  if (running || dragging || physics.remainingBiscuits(discs, color) === 0) {
    predictionMessage(
      'No queued biscuit is available to predict. Load a saved shot or return to the court.',
    );

    return;
  }

  changePredictionAccuracy();
  const field = input('predictionAccuracy');

  const next =
    field.value.trim() && Number.isFinite(Number(field.value))
      ? Math.max(0, Math.min(100, Number(field.value)))
      : accuracy();

  field.value = next.toFixed(1);
  PredictionAnimation.stop();
  const generation = ++predictionGeneration;
  const state = snapshot();

  state.paths = [];
  state.accuracy = next;
  const signature = predictionFingerprint(state);
  const record = PredictionModel.prepare(state);
  const exact = PredictionModel.deterministic(state);
  const start = performance.now();

  predictionBusy = true;
  renderPrediction();
  predictionMessage('Generating outcomes…');
  let target = exact ? 1 : 100;
  let extended = false;

  try {
    while (record.outcomes.length < target) {
      if (
        generation !== predictionGeneration ||
        signature !== predictionFingerprint({ ...snapshot(), accuracy: state.accuracy })
      ) {
        return;
      }

      const chunk = performance.now();

      do {
        record.outcomes.push(PredictionModel.trial(record));
      } while (record.outcomes.length < target && performance.now() - chunk < 12);
      if (
        generation !== predictionGeneration ||
        !element('predictionDialog').open ||
        signature !== predictionFingerprint({ ...snapshot(), accuracy: state.accuracy })
      ) {
        return;
      }

      if (!exact && !extended && record.outcomes.length === 100) {
        extended = true;
        // Include scheduling and rendering overhead in the measured runtime budget.
        if (performance.now() - start < 80) {
          target = 1000;
        }
      }

      predictionMessage(`Generating outcomes… ${record.outcomes.length} / ${target}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (generation !== predictionGeneration) {
      return;
    }

    record.count = record.outcomes.length;
    record.elapsedMs = Math.round(performance.now() - start);
    input('accuracy').value = state.accuracy.toFixed(1);
    predictionResult = record;
    predictionSignature = signature;
    predictionFilter = '';
    predictionVisible = new Set(record.biscuits.map((_, index) => index));
    input('predictionName').value = PredictionModel.suggestedName(record);
    input('predictionAccuracy').value = state.accuracy.toFixed(1);
    update();

    predictionMessage(
      `${record.count.toLocaleString()} ${exact ? 'deterministic outcome' : 'trials'} · ` +
        `${record.elapsedMs} ms. Estimates describe this simulator, not measured real-world odds.`,
    );
  } catch {
    predictionMessage('Prediction could not finish. Your board has not changed. Try regenerating.');
  } finally {
    if (generation === predictionGeneration) {
      predictionBusy = false;
      renderPrediction();
    }
  }
}

function initializePredictions() {
  PredictionAnimation.initialize(drawPrediction);
  element('openSavedPredictions').onclick = () => openSavedPredictions();
  bindDialog('savedPredictions', element('openSavedPredictions'));

  element('predictOutcomes').onclick = () => {
    if (!predictionResult) {
      input('predictionAccuracy').value = accuracy().toFixed(1);
    }

    openDialog('predictionDialog');
    renderSavedPredictions();
    if (predictionResult) {
      renderPrediction();
    } else {
      generatePrediction();
    }
  };

  element('savedShots').onclick = () => {
    if (!predictionResult) {
      input('predictionAccuracy').value = accuracy().toFixed(1);
    }

    openDialog('predictionDialog');
    renderPrediction();
    openSavedPredictions();
  };

  element('regeneratePrediction').onclick = generatePrediction;
  element('predictionAccuracy').addEventListener('input', () => changePredictionAccuracy(false));
  element('predictionAccuracy').addEventListener('change', () => changePredictionAccuracy());

  element('savePrediction').onclick = () => {
    if (!predictionResult || predictionBusy || predictionAccuracyOutOfSync()) {
      return;
    }

    try {
      const entry = PredictionStorage.save(
        localStorage,
        predictionResult,
        input('predictionName').value,
      );

      openSavedPredictions(entry.id);

      predictionMessage(
        `Saved “${entry.name}” · ${(entry.bytes / 1024).toFixed(1)} KB · ` +
          (entry.record.storage === 'summary'
            ? 'compact results (0.1-foot grid).'
            : 'all trial outcomes retained.'),
      );
    } catch (error) {
      predictionMessage(error.message || 'Could not save this shot. Existing saves are unchanged.');
    }
  };

  element('predictionScoreMode').addEventListener('change', () => {
    renderPredictionTable();
    drawPrediction();
  });

  element('predictionCourtView').addEventListener('change', drawPrediction);

  element('predictionShowAll').onclick = () => {
    predictionFilter = '';
    renderPredictionTable();
    drawPrediction();
  };

  element('predictionDialog').addEventListener('close', () => {
    if (element('savedPredictions').open) {
      element('savedPredictions').close();
    }

    PredictionAnimation.stop();
    predictionGeneration++;
    predictionBusy = false;
    renderPrediction();
  });

  bindDialog('predictionDialog', element('predictOutcomes'));
  new ResizeObserver(drawPrediction).observe(element('predictionCourt'));
  renderPrediction();
}

function loadPrediction(record, name = '') {
  if (predictionBusy || running || dragging) {
    predictionMessage('Wait for the current operation to finish before loading a shot.');

    return;
  }

  if (!PredictionStorage.validRecord(record)) {
    predictionMessage(
      'This saved shot is damaged or uses an unsupported format. The board has not changed.',
    );

    return;
  }

  if (element('savedPredictions').open) {
    element('savedPredictions').close();
  }

  restoreShot(record.state);
  shotHistory = [];
  lastShot = null;
  lastShotUndone = false;
  pendingSupplyColor = null;
  predictionResult = structuredClone(record);
  predictionSignature = predictionFingerprint(snapshot());
  predictionFilter = '';
  predictionVisible = new Set(record.biscuits.map((_, index) => index));
  input('predictionName').value = name || PredictionModel.suggestedName(record);
  input('predictionAccuracy').value = accuracy().toFixed(1);
  update();
  renderPrediction();

  predictionMessage(
    'Loaded starting board, settings, and saved results. Close to shoot, or Rege' +
      'nerate for fresh trials.' +
      (record.storage === 'summary' ? ' Compact results use a 0.1-foot position grid.' : ''),
  );

  element('regeneratePrediction').focus();
  element('predictionBody').scrollTop = 0;
}

function openSavedPredictions(focusId = '') {
  PredictionAnimation.stop();
  drawPrediction();
  if (!element('savedPredictions').open) {
    openDialog('savedPredictions');
  }

  renderSavedPredictions(focusId);
}

function predictionAccuracyOutOfSync() {
  const field = input('predictionAccuracy');

  return (
    !!predictionResult &&
    (!field.value.trim() ||
      !Number.isFinite(Number(field.value)) ||
      Number(field.value) !== predictionResult.state.accuracy)
  );
}

function predictionAction(text, action) {
  const node = predictionNode('button', text);

  node.type = 'button';
  node.onclick = action;

  return node;
}

function predictionFingerprint(state) {
  return JSON.stringify({ ...state, paths: [] });
}

function predictionMessage(message) {
  element('predictionStatus').textContent = message;
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} [text]
 * @param {string} [className]
 * @returns {HTMLElementTagNameMap[K]}
 */
function predictionNode(
  tag,
  text = '',
  className = '',
) {
  const node = document.createElement(tag);

  node.textContent = text;
  node.className = className;

  return node;
}

function predictionToggle(label, indices) {
  const wrapper = predictionNode(
    'label',
    '',
    'prediction-toggle',
  );

  const checkbox = document.createElement('input');

  checkbox.type = 'checkbox';
  const count = indices.filter((index) => predictionVisible.has(index)).length;

  checkbox.checked = count === indices.length;
  checkbox.indeterminate = count > 0 && count < indices.length;

  checkbox.onchange = () => {
    indices.forEach((index) =>
      checkbox.checked ? predictionVisible.add(index) : predictionVisible.delete(index),
    );

    // Keep the focused checkbox in place, including mixed color/all toggles.
    refreshPredictionToggles();
    drawPrediction();
  };

  checkbox.dataset.biscuits = indices.join(',');
  wrapper.append(checkbox, predictionNode('span', label));

  return wrapper;
}

function refreshPredictionToggles() {
  queryElements('#predictionBiscuits input').forEach((node) => {
    const checkbox = /** @type {HTMLInputElement} */ (node);
    const indices = checkbox.dataset.biscuits.split(',').map(Number);
    const count = indices.filter((index) => predictionVisible.has(index)).length;

    checkbox.checked = count === indices.length;
    checkbox.indeterminate = count > 0 && count < indices.length;
  });
}

function renderPrediction() {
  const ready = !!predictionResult;

  PredictionAnimation.configure(predictionResult, predictionBusy);
  element('predictionResults').hidden = !ready;
  renderPredictionSync();
  input('predictionAccuracy').disabled = predictionBusy;

  element('regeneratePrediction').disabled =
    predictionBusy || running || !!dragging || physics.remainingBiscuits(discs, color) === 0;

  element('predictionDialog').setAttribute('aria-busy', String(predictionBusy));
  if (!ready) {
    return;
  }

  const container = element('predictionBiscuits');

  container.replaceChildren();
  const all = predictionResult.biscuits.map((_, index) => index);

  container.append(predictionToggle('All', all));
  for (const color of ['yellow', 'black']) {
    const indices = all.filter((index) => predictionResult.biscuits[index].color === color);

    if (indices.length) {
      container.append(predictionToggle(color === 'yellow' ? 'Yellow' : 'Black', indices));
    }
  }

  predictionResult.biscuits.forEach((disc, index) =>
    container.append(predictionToggle(disc.label + (disc.shooter ? ' · shooter' : ''), [index])),
  );

  renderPredictionTable();
  drawPrediction();
}

function renderPredictionScoreboards() {
  const record = predictionResult;

  if (!record) {
    return;
  }

  const groups = PredictionModel.groups(record)
    .slice()
    .sort((a, b) => b.count - a.count);

  const intended = PredictionModel.intended(record);
  const keys = predictionFilter.split(';').filter(Boolean);
  const selected = groups.filter((group) => keys.includes(group.score.join(',')));
  const after = selected[0]?.score || (keys.length ? intended.score : groups[0].score);

  element('predictionBeforeYellow').textContent = String(record.beforeScore[0]);
  element('predictionBeforeBlack').textContent = String(record.beforeScore[1]);
  element('predictionAfterYellow').textContent = String(after[0]);
  element('predictionAfterBlack').textContent = String(after[1]);
  for (const [id, score] of [
    ['predictionBeforeYellow', record.beforeScore[0]],
    ['predictionBeforeBlack', record.beforeScore[1]],
    ['predictionAfterYellow', after[0]],
    ['predictionAfterBlack', after[1]],
  ]) {
    element(id).classList.toggle('negative-score', score < 0);
  }

  element('predictionAfterLabel').textContent = keys.length
    ? keys.length === 1
      ? 'After · selected outcome'
      : 'After · most likely selected outcome'
    : `After · most likely (${((groups[0].count / record.count) * 100).toFixed(1)}%)`;
}

function renderPredictionSync() {
  const stale = predictionAccuracyOutOfSync();

  element('regeneratePrediction').classList.toggle('prediction-out-of-sync', stale);
  element('predictionSyncMessage').hidden = !stale;
  element('savePrediction').disabled = !predictionResult || predictionBusy || stale;
}

function renderPredictionTable() {
  const record = predictionResult;

  if (!record) {
    return;
  }

  const delta = input('predictionScoreMode').value === 'delta';
  const head = element('predictionTableHead');
  const body = element('predictionTableBody');
  const intention = PredictionModel.intended(record);
  const intendedKey = intention.score.join(',');
  const groups = PredictionModel.groups(record);

  const intendedGroup = groups.find((group) => group.score.join(',') === intendedKey) || {
    count: 0,
    score: intention.score,
  };

  const rows = [
    intendedGroup,
    ...groups.filter((group) => group !== intendedGroup).sort((a, b) => b.count - a.count),
  ];

  const selected = new Set(predictionFilter.split(';').filter(Boolean));

  head.replaceChildren();
  body.replaceChildren();
  const heading = predictionNode('tr');

  for (const title of [
    delta ? 'Yellow Δ' : 'Yellow',
    delta ? 'Black Δ' : 'Black',
    'Likelihood',
    'View',
  ]) {
    const cell = predictionNode('th', title);

    cell.scope = 'col';
    if (title.toLowerCase().startsWith(record.state.color)) {
      cell.dataset.shooter = record.state.color;
      cell.title = (record.state.color === 'yellow' ? 'Yellow' : 'Black') + ' is shooting';
    }

    heading.append(cell);
  }

  head.append(heading);
  for (const group of rows) {
    const key = group.score.join(',');
    const intended = key === intendedKey;

    const tr = predictionNode(
      'tr',
      '',
      intended ? 'prediction-intended' : '',
    );

    const numbers = group.score.map((score, index) =>
      delta ? score - record.beforeScore[index] : score,
    );

    const scores = numbers.map((score) =>
      score === 0 ? '—' : delta && score > 0 ? '+' + score : String(score),
    );

    tr.dataset.score = key;
    tr.dataset.intended = String(intended);

    numbers.forEach((score, index) => {
      const cell = predictionNode('td', scores[index]);

      if (score === 0) {
        cell.setAttribute('aria-label', '0');
      } else if (delta) {
        const shooter = (index === 0 ? 'yellow' : 'black') === record.state.color;

        cell.className = score > 0 === shooter ? 'score-benefit' : 'score-cost';
      }

      tr.append(cell);
    });

    const probability = `${((group.count / record.count) * 100).toFixed(1)}%`;

    tr.append(predictionNode('td', probability));
    const cell = predictionNode('td');

    const label = predictionNode(
      'label',
      '',
      'prediction-outcome-choice',
    );

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(key);
    checkbox.dataset.filter = key;

    checkbox.setAttribute(
      'aria-label',
      `${intended ? 'Intended outcome' : 'Show outcome'}: ` +
        `Yellow ${numbers[0]}, Black ${numbers[1]}, ${probability}`,
    );

    checkbox.onchange = () => {
      const keys = new Set(predictionFilter.split(';').filter(Boolean));

      checkbox.checked ? keys.add(key) : keys.delete(key);
      predictionFilter = [...keys].join(';');
      drawPrediction();
    };

    label.append(checkbox);
    if (intended) {
      label.append(predictionNode('span', 'Intended'));
      label.title = 'Intended result with perfect accuracy and no fast-shot handicap';
    }

    cell.append(label);
    tr.append(cell);
    body.append(tr);
  }

  element('predictionTableCaption').textContent = delta
    ? 'Predicted score changes'
    : 'Predicted final board scores';

  element('predictionBaseline').textContent =
    (delta
      ? 'Δ shows the change for each player. '
      : 'Final scores include every biscuit already on the board. ') +
    ('Intended is the perfect shot without the fast-shot handicap. Other rows des' +
      'cend by likelihood. ') +
    'Check multiple outcomes to combine their trials. With none checked, all trials are shown. ' +
    'The after scoreboard shows the most likely checked outcome. — means zero score. ' +
    (delta ? 'Green benefits the shooter; red benefits their opponent.' : '');

  element('predictionScoreHelp').title = element('predictionBaseline').textContent;
}

function renderSavedPredictions(focusId = '') {
  const list = element('savedPredictionList');

  list.replaceChildren();
  try {
    const records = PredictionStorage.read(localStorage);

    element('savedPredictionCount').textContent = `Saved shots (${records.length}/20)`;
    if (!records.length) {
      list.append(predictionNode('p', 'No saved shots yet. Generate a prediction to save one.'));
    }

    for (const entry of records) {
      const row = predictionNode(
        'li',
        '',
        'saved-prediction',
      );

      const label = predictionNode('label', 'Shot name');
      const name = document.createElement('input');

      name.type = 'text';
      name.maxLength = 120;
      name.value = entry.name;
      label.append(name);

      row.append(
        label,
        predictionNode(
          'small',
          `${entry.record.count} trials · ${entry.record.storage === 'summary' ? 'compact summary' : 'full results'}`,
        ),
      );

      const actions = predictionNode(
        'div',
        '',
        'prediction-actions',
      );

      actions.append(
        predictionAction('Load', () => loadPrediction(entry.record, entry.name)),
        predictionAction('Rename', () => {
          try {
            PredictionStorage.rename(
              localStorage,
              entry.id,
              name.value,
            );

            name.value =
              name.value.trim().slice(0, 120) || PredictionModel.suggestedName(entry.record);

            entry.name = name.value;
            predictionMessage('Saved shot renamed.');
          } catch {
            predictionMessage(
              'Could not rename this shot. Storage may be unavailable; the saved name is unchanged.',
            );
          }
        }),
        predictionAction('Delete', () => {
          try {
            PredictionStorage.remove(localStorage, entry.id);
            renderSavedPredictions();
            element('savedPredictionCount').focus();
            predictionMessage('Saved shot deleted.');
          } catch {
            predictionMessage('Could not delete this shot. Storage may be unavailable.');
          }
        }),
      );

      row.append(actions);
      list.append(row);
      if (entry.id === focusId) {
        name.focus({ preventScroll: true });
        name.select();
        row.scrollIntoView({ block: 'nearest' });
      }
    }
  } catch {
    list.append(
      predictionNode(
        'p',
        'Saved shots could not be read. Existing storage has been left untouched.',
      ),
    );
  }
}

function syncPrediction() {
  element('predictOutcomes').disabled =
    running || !!dragging || physics.remainingBiscuits(discs, color) === 0;

  const current = snapshot();

  if (
    predictionResult &&
    predictionSignature !==
      predictionFingerprint({ ...current, accuracy: predictionResult.state.accuracy })
  ) {
    predictionResult = null;
    PredictionAnimation.configure(null);
    predictionGeneration++;
    predictionBusy = false;
    predictionMessage('Shot changed. Generate new outcomes or load a saved shot.');
    if (element('predictionDialog').open) {
      renderPrediction();
    }
  } else if (predictionResult && !element('predictionDialog').open) {
    input('predictionAccuracy').value = accuracy().toFixed(1);
  }

  renderPredictionSync();
}
