/* exported
  drawPrediction,
  initializePredictions,
  syncPrediction
*/
'use strict';
let predictionResult = null;
let predictionFilter = '*';
let predictionCourtView = 'receiving';
let predictionScoreMode = 'delta';
let predictionShowIntention = true;
let predictionShowStarts = true;

const predictionViewport = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

let predictionPanDrag = null;
let predictionVisible = new Set();
let predictionGeneration = 0;
let predictionBusy = false;
let predictionSignature = '';

function changePredictionAccuracy(normalize = true, persist = false) {
  const field = input('predictionAccuracy');

  if (normalize && field.value.trim() && Number.isFinite(Number(field.value))) {
    field.value = Math.max(0, Math.min(100, Number(field.value))).toFixed(1);
  }

  if (persist && field.value.trim() && Number.isFinite(Number(field.value))) {
    saveAccuracyPreference(Number(field.value));
  }

  renderPredictionSync();
}

function drawPrediction() {
  const record = predictionResult;

  if (!record || !element('predictionDialog').open) {
    return;
  }

  const framing = PredictionAnimation.framing(record, predictionFilter);
  const courtView = framing || predictionCourtView;

  const viewport = framing
    ? {
        panX: 0,
        panY: 0,
        zoom: 1,
      }
    : predictionViewport;

  const zoom = courtView !== 'full';

  renderPredictionModes(courtView);
  updatePredictionZoomControls(viewport);
  element('predictionCourt').dataset.view = zoom ? 'receiving' : 'full';

  render(
    'predictionCourt',
    zoom,
    record,
    viewport,
  );

  const ctx = element('predictionCourt').getContext('2d');
  const { map, scale } = viewMaps.predictionCourt;

  const mapPhysical = (x, y) => {
    const point = PredictionModel.physical({ x, y }, record.state.shootingEnd);

    return map(point.x, point.y);
  };

  const count = PredictionModel.selectionGroups(record)
    .filter((group) => PredictionModel.matches(group.key, predictionFilter))
    .reduce((sum, group) => sum + group.count, 0);

  const animated = PredictionAnimation.points(record, predictionFilter);

  const points =
    animated ||
    PredictionModel.points(record).filter((point) =>
      PredictionModel.matches(point.selectionKey || point.key + '|0', predictionFilter),
    );

  const collected = record.biscuits.map(() => 0);

  const biscuit = (
    position,
    ink,
    intended = false,
  ) => {
    if (position[2]) {
      return;
    }

    const q = mapPhysical(position[0], position[1]);

    ctx.beginPath();

    ctx.arc(
      q[0],
      q[1],
      physics.R * scale,
      0,
      Math.PI * 2,
    );

    ctx.fillStyle = ink;
    ctx.fill();
    if (intended) {
      ctx.strokeStyle = '#f5fff4';
      ctx.lineWidth = 2;
      ctx.setLineDash([1, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const route = (
    path,
    ink,
    intended = false,
  ) => {
    if (!path || path.length < 2) {
      return;
    }

    ctx.beginPath();

    path.forEach(([x, y], index) => {
      const q = mapPhysical(x, y);

      index ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    });

    ctx.strokeStyle = ink;
    ctx.lineWidth = intended ? 1.8 : 1;
    ctx.setLineDash(intended ? [1, 2] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  for (const point of points) {
    if (!predictionVisible.has(point.biscuit)) {
      continue;
    }

    ctx.globalAlpha = Math.min(
      1,
      2 * Math.max(1 / 255, 1 - Math.exp((-12 * point.count) / Math.max(1, count))),
    );

    const disc = record.biscuits[point.biscuit];
    const ink = disc.color === 'yellow' ? '#ffe06a' : '#101b27';

    route(point.path, ink);
    if (point.position[2]) {
      collected[point.biscuit] += point.count;
    }

    biscuit(point.position, ink);
  }

  ctx.globalAlpha = 1;
  if (predictionShowStarts) {
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
  }

  // Intention visibility is independent of the sampled-outcome filter.
  if (predictionShowIntention) {
    const intention = PredictionModel.intended(record);

    record.biscuits.forEach((disc, index) => {
      if (!predictionVisible.has(index)) {
        return;
      }

      const ink = disc.color === 'yellow' ? '#ffe06a' : '#101b27';

      route(
        intention.paths[index],
        ink,
        true,
      );

      const intendedPosition = intention.positions[index];

      biscuit(
        [
          intendedPosition[0],
          intendedPosition[1],
          0,
        ],
        ink,
        true,
      );
    });
  }

  renderPredictionScoreboards();
  refreshPredictionSelection();
  const chance = (100 * count) / record.count;

  element('predictionSelectedChance').textContent = chance.toFixed(1) + '%';
  element('predictionSelectedChance').title = 'Selected Outcome %: ' + chance.toFixed(1) + '%';

  const summaries = collected
    .map((amount, index) =>
      predictionVisible.has(index)
        ? record.biscuits[index].label +
          ': ' +
          ((100 * amount) / Math.max(1, count)).toFixed(1) +
          '%'
        : '',
    )
    .filter(Boolean);

  element('predictionCollected').textContent =
    'Collected: ' + summaries.join(' · ') + '. Collected biscuits score zero.';

  element('predictionMapSummary').textContent =
    count +
    ' of ' +
    record.count +
    (' trials selected. Trial positions and actual routes use twice the original ' +
      'density-scaled opacity. Long d' +
      'ashes show starting positions; opaque biscuits and short dots show the inte' +
      'nded perfect-shot positions and routes. ') +
    (record.bins && !record.selectionGroups
      ? 'Regenerate this older compact save for routes and self-kitchen filtering. '
      : '');

  element('predictionCourt').title =
    element('predictionMapSummary').textContent + ' ' + element('predictionCollected').textContent;
}

function exportPredictionRecords(records, filename) {
  const json = PredictionStorage.exportRecords(records);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  predictionMessage(
    'Exported ' + records.length + ' saved shot' + (records.length === 1 ? '.' : 's.'),
  );
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
    predictionFilter = '*';
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

function initializePredictionTransfer() {
  element('exportPredictions').onclick = () => {
    try {
      exportPredictionRecords(PredictionStorage.read(localStorage), 'shuffleboard-shots.json');
    } catch (error) {
      predictionMessage(error.message || 'Could not export saved shots.');
    }
  };

  element('importPredictions').onclick = () => element('importPredictionFile').click();

  element('importPredictionFile').onchange = async () => {
    const field = element('importPredictionFile');
    const file = field.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('This file is too large. Import files must be below 50 MB.');
      }

      const result = PredictionStorage.importRecords(localStorage, await file.text());

      renderSavedPredictions();

      predictionMessage(
        'Imported ' + result.imported + ' shots; skipped ' + result.skipped + ' duplicates.',
      );

      element('savedPredictionCount').focus();
    } catch (error) {
      predictionMessage(error.message || 'Import failed. No saved shots were changed.');
    } finally {
      field.value = '';
    }
  };
}

function initializePredictionZoom() {
  const canvas = element('predictionCourt');

  element('predictionZoomIn').onclick = () => {
    takePredictionCameraControl();
    setPredictionZoom(predictionViewport.zoom + 0.25);
  };

  element('predictionZoomOut').onclick = () => {
    takePredictionCameraControl();
    setPredictionZoom(predictionViewport.zoom - 0.25);
  };

  element('predictionZoom').addEventListener('input', () =>
    setPredictionZoom(Number(input('predictionZoom').value)),
  );

  element('predictionZoomReset').onclick = () => {
    Object.assign(predictionViewport, {
      panX: 0,
      panY: 0,
      zoom: 1,
    });

    setPredictionZoom(1);
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (canvas.dataset.zoomed !== 'true' || predictionPanDrag || event.button > 0) {
      return;
    }

    event.preventDefault();

    predictionPanDrag = {
      panX: predictionViewport.panX,
      panY: predictionViewport.panY,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (predictionPanDrag?.pointerId !== event.pointerId) {
      return;
    }

    predictionViewport.panX = predictionPanDrag.panX + event.clientX - predictionPanDrag.x;
    predictionViewport.panY = predictionPanDrag.panY + event.clientY - predictionPanDrag.y;
    drawPrediction();
  });

  for (const name of [
    'pointerup',
    'pointercancel',
    'lostpointercapture',
  ]) {
    canvas.addEventListener(name, (event) => {
      const pointer = /** @type {PointerEvent} */ (event);

      if (predictionPanDrag?.pointerId === pointer.pointerId) {
        predictionPanDrag = null;
      }
    });
  }

  canvas.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      takePredictionCameraControl();
      setPredictionZoom(predictionViewport.zoom + 0.25);
    }

    if (event.key === '-') {
      event.preventDefault();
      takePredictionCameraControl();
      setPredictionZoom(predictionViewport.zoom - 0.25);
    }

    if (
      Number(input('predictionZoom').value) > 1 &&
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
      ].includes(event.key)
    ) {
      event.preventDefault();

      predictionViewport.panX +=
        event.key === 'ArrowLeft' ? 24 : event.key === 'ArrowRight' ? -24 : 0;

      predictionViewport.panY += event.key === 'ArrowUp' ? 24 : event.key === 'ArrowDown' ? -24 : 0;
      drawPrediction();
    }
  });

  setPredictionZoom(1);
}

function initializePredictions() {
  PredictionAnimation.initialize(drawPrediction);
  initializePredictionZoom();
  initializePredictionTransfer();

  const renderLayers = () => {
    element('predictionToggleIntention').textContent =
      (predictionShowIntention ? 'Hide' : 'Show') + ' Shot Intention';

    element('predictionToggleIntention').setAttribute(
      'aria-pressed',
      String(predictionShowIntention),
    );

    element('predictionToggleStarts').textContent =
      (predictionShowStarts ? 'Hide' : 'Show') + ' Starting Biscuits';

    element('predictionToggleStarts').setAttribute('aria-pressed', String(predictionShowStarts));
  };

  element('predictionToggleIntention').onclick = () => {
    predictionShowIntention = !predictionShowIntention;
    renderLayers();
    drawPrediction();
  };

  element('predictionToggleStarts').onclick = () => {
    predictionShowStarts = !predictionShowStarts;
    renderLayers();
    drawPrediction();
  };

  renderLayers();
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

  element('predictionAccuracy').addEventListener('input', () =>
    changePredictionAccuracy(false, true),
  );

  element('predictionAccuracy').addEventListener('change', () =>
    changePredictionAccuracy(true, true),
  );

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

  for (const [id, mode] of [
    ['predictionFinalScore', 'final'],
    ['predictionDeltaScore', 'delta'],
  ]) {
    element(id).onclick = () => {
      predictionScoreMode = mode;
      renderPredictionModes();
      renderPredictionTable();
      drawPrediction();
    };
  }

  for (const [id, mode] of [
    ['predictionFullCourt', 'full'],
    ['predictionScoringEnd', 'receiving'],
  ]) {
    element(id).onclick = () => {
      takePredictionCameraControl();
      predictionCourtView = mode;
      renderPredictionModes();
      drawPrediction();
    };
  }

  element('predictionClearAll').onclick = () => {
    predictionFilter = '';
    renderPredictionTable();
    drawPrediction();
  };

  element('predictionShowAll').onclick = () => {
    predictionFilter = '*';
    renderPredictionTable();
    drawPrediction();
  };

  element('predictionDialog').addEventListener('close', () => {
    if (element('savedPredictions').open) {
      element('savedPredictions').close();
    }

    PredictionAnimation.stop();
    predictionPanDrag = null;
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
  physics.collectOffCourt(discs);
  shotHistory = [];
  lastShot = null;
  lastShotUndone = false;
  pendingSupplyColor = null;
  predictionResult = structuredClone(record);

  const movedCollection = record.state.discs.some(
    (disc, index) => disc.out && (disc.x !== discs[index].x || disc.y !== discs[index].y),
  );

  predictionResult.state.discs = structuredClone(discs);

  predictionResult.biscuits.forEach((biscuit, index) => {
    if (biscuit.out && discs[index]) {
      const point = PredictionModel.physical(discs[index], shootingEnd);

      biscuit.x = point.x;
      biscuit.y = point.y;
    }
  });

  if (movedCollection) {
    delete predictionResult.intended;
  }

  predictionResult.intended = PredictionModel.intended(predictionResult);
  predictionSignature = predictionFingerprint(snapshot());
  predictionFilter = '*';
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
  element('savedPredictionStatus').textContent = '';
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

function predictionBytes(size) {
  if (size < 1024) {
    return size + ' B';
  }

  return size >= 1024 * 1024
    ? (size / (1024 * 1024)).toFixed(1) + ' MB'
    : Math.max(1, Math.round(size / 1024)) + ' KB';
}

function predictionFingerprint(state) {
  return JSON.stringify({ ...state, paths: [] });
}

function predictionMessage(message) {
  element('predictionStatus').textContent = message;
  if (element('savedPredictions').open) {
    element('savedPredictionStatus').textContent = message;
  }
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

function predictionSelectionGroups() {
  const groups = PredictionModel.selectionGroups(predictionResult).slice();
  const intended = PredictionModel.intended(predictionResult);
  const key = PredictionModel.selectionKey(predictionResult, intended);

  if (!groups.some((group) => group.key === key)) {
    groups.push({
      count: 0,
      key,
      score: intended.score,
    });
  }

  return groups;
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

function refreshPredictionSelection() {
  const groups = predictionSelectionGroups();

  queryElements('#predictionTableBody input').forEach((node) => {
    const checkbox = /** @type {HTMLInputElement} */ (node);
    const matching = groups.filter((group) => group.score.join(',') === checkbox.dataset.filter);

    const checked = matching.filter((group) =>
      PredictionModel.matches(group.key, predictionFilter),
    ).length;

    checkbox.checked = checked === matching.length;
    checkbox.indeterminate = checked > 0 && checked < matching.length;
  });

  queryElements('#predictionScenarios button').forEach((node) => {
    const keys = groups
      .filter(
        (group) =>
          group.count &&
          PredictionModel.scenario(
            predictionResult,
            group,
            node.dataset.scenario,
          ),
      )
      .map((group) => group.key);

    const chosen = groups
      .filter((group) => group.count && PredictionModel.matches(group.key, predictionFilter))
      .map((group) => group.key);

    node.setAttribute(
      'aria-pressed',
      String(
        keys.length > 0 &&
          keys.length === chosen.length &&
          keys.every((key) => chosen.includes(key)),
      ),
    );
  });

  element('predictionShowAll').setAttribute('aria-pressed', String(predictionFilter === '*'));
  element('predictionClearAll').setAttribute('aria-pressed', String(predictionFilter === ''));
  const sampleGroups = PredictionModel.selectionGroups(predictionResult);

  PredictionAnimation.selection(
    sampleGroups.every((group) => PredictionModel.matches(group.key, predictionFilter)),
    sampleGroups.some((group) => PredictionModel.matches(group.key, predictionFilter)),
  );
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
  renderPredictionModes();
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

  renderPredictionScenarios();
  renderPredictionTable();
  drawPrediction();
}

function renderPredictionModes(courtView = predictionCourtView) {
  /** @type {[string, boolean][]} */
  const modes = [
    ['predictionFinalScore', predictionScoreMode === 'final'],
    ['predictionDeltaScore', predictionScoreMode === 'delta'],
    ['predictionFullCourt', courtView === 'full'],
    ['predictionScoringEnd', courtView !== 'full'],
  ];

  for (const [id, active] of modes) {
    element(id).setAttribute('aria-pressed', String(active));
  }
}

function renderPredictionScenarios() {
  const container = element('predictionScenarios');

  container.replaceChildren();

  const scoreFilters = predictionNode(
    'div',
    '',
    'prediction-score-filters',
  );

  scoreFilters.setAttribute('aria-label', 'Score change filters');
  scoreFilters.setAttribute('role', 'group');
  for (const [name, label] of [
    ['self-kitchen', 'Self-kitchen'],
    ['yellow-increases', 'Yellow ↑'],
    ['yellow-decreases', 'Yellow ↓'],
    ['black-increases', 'Black ↑'],
    ['black-decreases', 'Black ↓'],
  ]) {
    const button = predictionAction(label, () => {
      predictionFilter = predictionSelectionGroups()
        .filter((group) =>
          PredictionModel.scenario(
            predictionResult,
            group,
            name,
          ),
        )
        .map((group) => group.key)
        .join(';');

      drawPrediction();
    });

    button.dataset.scenario = name;
    if (name.startsWith('yellow')) {
      button.className = 'yellow';
    }

    if (name.startsWith('black')) {
      button.className = 'black';
    }

    button.title =
      name === 'self-kitchen'
        ? 'Select outcomes where the delivered biscuit finishes in its kitchen'
        : 'Select outcomes where ' + name.replace('-', ' score ');

    button.disabled =
      name === 'self-kitchen' && !!predictionResult.bins && !predictionResult.selectionGroups;

    if (name === 'self-kitchen') {
      container.append(button);
    } else {
      scoreFilters.append(button);
    }
  }

  container.append(scoreFilters);
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

  const selected = PredictionModel.selectionGroups(record).filter((group) =>
    PredictionModel.matches(group.key, predictionFilter),
  );

  const selectedKeys = new Set(selected.map((group) => group.score.join(',')));

  const chosen = groups
    .filter((group) => selectedKeys.has(group.score.join(',')))
    .map((group) => ({
      count: selected
        .filter((part) => part.score.join(',') === group.score.join(','))
        .reduce((sum, part) => sum + part.count, 0),
      score: group.score,
    }))
    .sort((a, b) => b.count - a.count);

  const after = chosen[0]?.score || intended.score;

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

  element('predictionAfterLabel').textContent = chosen.length
    ? predictionFilter === '*'
      ? 'After · most likely'
      : 'After · most likely selected outcome'
    : 'After · intention (no trials selected)';
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

  const delta = predictionScoreMode === 'delta';
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

  head.replaceChildren();
  body.replaceChildren();
  const heading = predictionNode('tr');

  for (const title of [
    delta ? 'Yellow Δ' : 'Yellow',
    delta ? 'Black Δ' : 'Black',
    'Delta',
    'Likelihood',
    'View',
  ]) {
    const cell = predictionNode('th', title);

    cell.scope = 'col';
    if (title.toLowerCase().startsWith(record.state.color)) {
      cell.dataset.shooter = record.state.color;
      cell.setAttribute('aria-label', title + ' (Shooting)');
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
      } else {
        cell.className = score > 0 ? 'score-positive' : 'score-negative';
      }

      if ((index === 0 ? 'yellow' : 'black') === record.state.color) {
        cell.dataset.shooter = record.state.color;
      }

      tr.append(cell);
    });

    const balance =
      group.score[0] - record.beforeScore[0] - (group.score[1] - record.beforeScore[1]);

    tr.append(
      predictionNode(
        'td',
        balance === 0 ? '—' : (balance > 0 ? 'Yellow +' : 'Black +') + Math.abs(balance),
        balance === 0 ? '' : balance > 0 ? 'advantage-yellow' : 'advantage-black',
      ),
    );

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
    checkbox.checked = false;
    checkbox.dataset.filter = key;

    checkbox.setAttribute(
      'aria-label',
      `${intended ? 'Intended outcome' : 'Show outcome'}: ` +
        `Yellow ${numbers[0]}, Black ${numbers[1]}, ${probability}`,
    );

    checkbox.onchange = () => {
      const groups = predictionSelectionGroups();

      const keys = new Set(
        groups
          .filter((group) => PredictionModel.matches(group.key, predictionFilter))
          .map((group) => group.key),
      );

      groups
        .filter((group) => group.score.join(',') === key)
        .forEach((group) => (checkbox.checked ? keys.add(group.key) : keys.delete(group.key)));

      predictionFilter = [...keys].join(';');
      drawPrediction();
    };

    label.append(checkbox);
    if (intended) {
      label.append(predictionNode('span', '*'));
      label.title = 'Intended result with perfect accuracy and no fast-shot handicap';
    }

    const only = predictionAction('Only', () => {
      predictionFilter = predictionSelectionGroups()
        .filter((group) => group.score.join(',') === key)
        .map((group) => group.key)
        .join(';');

      drawPrediction();
    });

    only.className = 'prediction-outcome-only';

    only.setAttribute(
      'aria-label',
      'Show only this outcome: Yellow ' + numbers[0] + ', Black ' + numbers[1],
    );

    only.title = 'Select only this row’s outcomes';
    cell.append(label, only);
    tr.append(cell);
    body.append(tr);
  }

  element('predictionTableCaption').textContent = 'Outcomes';

  element('predictionShooterLabel').textContent =
    (record.state.color === 'yellow' ? 'Yellow' : 'Black') + ' (Shooting)';

  element('predictionBaseline').textContent =
    (delta
      ? 'Δ shows the change for each player. '
      : 'Final scores include every biscuit already on the board. ') +
    ('Intended is the perfect shot without the fast-shot handicap. Other rows des' +
      'cend by likelihood. ') +
    ('All outcomes start checked. Check multiple outcomes to combine their trials' +
      '. No checks means no sampled outcomes. ') +
    ('The after scoreboard shows the most likely checked outcome. Delta is the sc' +
      'ore-change advantage, naming the player ahead. — means zero. ') +
    ('Player scores are bold green when positive and bold red when negative. Delt' +
      'a text uses the leading player’s color.');

  element('predictionScoreHelp').title = element('predictionBaseline').textContent;
}

function renderSavedPredictions(focusId = '') {
  const list = element('savedPredictionList');

  list.replaceChildren();
  try {
    const records = PredictionStorage.read(localStorage);

    element('savedPredictionCount').textContent =
      `Saved shots (${records.length}/${PredictionStorage.limit})`;

    element('savedPredictionSize').textContent =
      predictionBytes(PredictionStorage.bytes(records)) + ' JSON';

    element('exportPredictions').disabled = records.length === 0;
    if (!records.length) {
      list.append(predictionNode('p', 'No saved shots yet. Generate a prediction to save one.'));
    }

    for (const entry of records) {
      const row = predictionNode(
        'li',
        '',
        'saved-prediction',
      );

      const label = predictionNode(
        'div',
        '',
        'saved-prediction-name',
      );

      const name = document.createElement('input');

      name.type = 'text';
      name.maxLength = 120;
      name.value = entry.name;
      name.readOnly = entry.id !== focusId;
      name.setAttribute('aria-label', 'Shot name');

      const edit = predictionAction('✏️', () => {
        name.readOnly = false;
        name.focus();
        name.select();
      });

      edit.className = 'icon-button';
      edit.title = 'Edit shot name';
      edit.setAttribute('aria-label', 'Edit shot name');

      const commitName = () => {
        if (name.readOnly) {
          return;
        }

        try {
          if (name.value.trim() !== entry.name) {
            PredictionStorage.rename(
              localStorage,
              entry.id,
              name.value,
            );

            entry.name =
              name.value.trim().slice(0, 120) || PredictionModel.suggestedName(entry.record);

            element('savedPredictionSize').textContent =
              predictionBytes(PredictionStorage.bytes(PredictionStorage.read(localStorage))) +
              ' JSON';

            predictionMessage('Saved shot renamed.');
          }
        } catch {
          predictionMessage('Could not rename this shot. The saved name is unchanged.');
        }

        name.value = entry.name;
        name.readOnly = true;
      };

      name.onblur = commitName;

      name.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitName();
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          name.value = entry.name;
          name.readOnly = true;
        }
      };

      label.append(name, edit);

      row.append(
        label,
        predictionNode(
          'small',
          `${entry.record.count} trials · ${entry.record.storage === 'summary' ? 'compact summary' : 'full results'} · ${predictionBytes(PredictionStorage.bytes(entry.record))} JSON`,
        ),
      );

      const actions = predictionNode(
        'div',
        '',
        'prediction-actions',
      );

      actions.append(
        predictionAction('🔮', () => loadPrediction(entry.record, entry.name)),
        predictionAction('Export', () => {
          try {
            exportPredictionRecords(
              [entry],
              'shuffleboard-shot-' + entry.id.replace(/[^a-z0-9-]/gi, '-') + '.json',
            );
          } catch (error) {
            predictionMessage(error.message || 'Could not export this saved shot.');
          }
        }),
        predictionAction('🗑️', () => {
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

      const load = /** @type {HTMLButtonElement} */ (actions.children[0]);

      load.className = 'icon-button';
      load.title = 'Load shot';
      load.setAttribute('aria-label', 'Load shot');
      const remove = /** @type {HTMLButtonElement} */ (actions.children[2]);

      remove.className = 'icon-button saved-prediction-delete';
      remove.title = 'Delete shot';
      remove.setAttribute('aria-label', 'Delete shot');
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

function setPredictionZoom(value) {
  takePredictionCameraControl();
  const next = Math.max(1, Math.min(4, value));
  const ratio = next / predictionViewport.zoom;

  predictionViewport.panX *= ratio;
  predictionViewport.panY *= ratio;
  predictionViewport.zoom = next;
  if (next === 1) {
    predictionViewport.panX = 0;
    predictionViewport.panY = 0;
  }

  updatePredictionZoomControls(predictionViewport);
  drawPrediction();
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

function takePredictionCameraControl() {
  const framing = PredictionAnimation.framing(predictionResult, predictionFilter);

  if (!framing) {
    return;
  }

  predictionCourtView = framing;

  Object.assign(predictionViewport, {
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  PredictionAnimation.manualView();
}

function updatePredictionZoomControls(viewport) {
  input('predictionZoom').value = String(viewport.zoom);
  element('predictionZoomValue').textContent = Math.round(viewport.zoom * 100) + '%';
  element('predictionCourt').dataset.zoomed = String(viewport.zoom > 1);
  element('predictionZoomIn').disabled = viewport.zoom >= 4;
  element('predictionZoomOut').disabled = viewport.zoom <= 1;
}
