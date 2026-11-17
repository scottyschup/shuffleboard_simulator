(function (root) {
  'use strict';

  const model =
    typeof module === 'undefined' ? root.PredictionModel : require('./prediction-model.js');

  const key = 'shotLab.predictions.v1';
  const fullLimit = 500 * 1024;
  const maxRecords = 25;

  function bytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }

  function exportRecords(records) {
    if (
      !Array.isArray(records) ||
      records.length > maxRecords ||
      records.some((entry) => !validImportEntry(entry))
    ) {
      throw new Error('These saved records cannot be exported because their data is invalid.');
    }

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        format: 'shuffleboard-shot-lab',
        shots: records,
        version: 1,
      },
      null,
      2,
    );
  }

  function importRecords(storage, json) {
    let data;

    try {
      data = JSON.parse(json);
    } catch {
      throw new Error('This file is not valid JSON. No saved shots were changed.');
    }

    let incoming;

    if (Array.isArray(data)) {
      incoming = data;
    } else if (data?.format === 'shuffleboard-shot-lab' && data.version === 1) {
      incoming = data.shots;
    } else if (data?.record && typeof data.name === 'string') {
      incoming = [data];
    }

    if (
      !Array.isArray(incoming) ||
      incoming.length > maxRecords ||
      incoming.some((entry) => !validImportEntry(entry))
    ) {
      throw new Error(
        'This file contains invalid or unsupported shot records. No saved shots were changed.',
      );
    }

    const current = read(storage);
    const merged = current.slice();

    const fingerprints = new Set(
      current.map((entry) => entry.name + '\u0000' + JSON.stringify(entry.record)),
    );

    let imported = 0,
      skipped = 0;

    for (const entry of incoming) {
      const record =
        bytes(entry.record) < fullLimit
          ? structuredClone(entry.record)
          : model.summarize(entry.record);

      const name = entry.name.trim().slice(0, 120) || model.suggestedName(record);
      const fingerprint = name + '\u0000' + JSON.stringify(record);

      if (fingerprints.has(fingerprint)) {
        skipped++;
        continue;
      }

      fingerprints.add(fingerprint);
      const seed = Date.now() + '-' + Math.random().toString(36).slice(2);
      let id = entry.id || seed,
        suffix = 0;

      while (merged.some((saved) => saved.id === id)) {
        id = seed + '-' + ++suffix;
      }

      merged.push({
        id,
        name,
        record,
      });

      imported++;
    }

    if (merged.length > maxRecords) {
      throw new Error('Import would exceed the 25-shot limit. No saved shots were changed.');
    }

    const stored = imported ? write(storage, merged) : current;

    return {
      bytes: bytes(stored),
      count: stored.length,
      imported,
      skipped,
    };
  }

  function read(storage) {
    const raw = storage.getItem(key);

    if (raw === null) {
      return [];
    }

    let records;

    try {
      records = JSON.parse(raw);
    } catch {
      throw new Error('Saved-shot data could not be read. Existing data has been left untouched.');
    }

    if (
      !Array.isArray(records) ||
      records.length > maxRecords ||
      records.some(
        (entry) =>
          !entry ||
          typeof entry.id !== 'string' ||
          typeof entry.name !== 'string' ||
          !validRecord(entry.record),
      )
    ) {
      throw new Error('Saved-shot data is invalid. Existing data has been left untouched.');
    }

    return records;
  }

  function remove(storage, id) {
    storage.setItem(key, JSON.stringify(read(storage).filter((entry) => entry.id !== id)));
  }

  function rename(
    storage,
    id,
    name,
  ) {
    const records = read(storage);
    const entry = records.find((item) => item.id === id);

    if (!entry) {
      throw new Error('This saved shot no longer exists.');
    }

    entry.name = name.trim().slice(0, 120) || model.suggestedName(entry.record);
    storage.setItem(key, JSON.stringify(records));
  }

  function save(
    storage,
    record,
    name,
  ) {
    const records = read(storage);

    if (records.length >= maxRecords) {
      throw new Error('You have 25 saved shots. Delete one before saving another.');
    }

    const saved = bytes(record) < fullLimit ? structuredClone(record) : model.summarize(record);

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name.trim().slice(0, 120) || model.suggestedName(record),
      record: saved,
    };

    const stored = write(storage, [...records, entry]);
    const savedEntry = stored.find((item) => item.id === entry.id);

    return { ...savedEntry, bytes: bytes(savedEntry.record) };
  }

  function validImportEntry(entry) {
    if (
      !entry ||
      typeof entry.name !== 'string' ||
      (entry.id !== undefined && (typeof entry.id !== 'string' || entry.id.length > 200)) ||
      !validRecord(entry.record)
    ) {
      return false;
    }

    const record = entry.record,
      state = record.state;

    if (
      !Array.isArray(state.paths) ||
      !state.paths.every(
        (path) =>
          Array.isArray(path) &&
          path.every(
            (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite),
          ),
      ) ||
      ((record.bins !== undefined || record.summary !== undefined) &&
        record.storage !== 'summary') ||
      (record.outcomes !== undefined && !Array.isArray(record.outcomes)) ||
      state.discs.some((disc) => typeof disc.out !== 'boolean') ||
      record.biscuits.some(
        (disc, index) =>
          typeof disc.label !== 'string' ||
          disc.label.length > 120 ||
          typeof disc.out !== 'boolean' ||
          disc.shooter !== (index === state.discs.length) ||
          disc.color !== (state.discs[index]?.color || state.color),
      )
    ) {
      return false;
    }

    const validOutcome = (outcome) =>
      (!outcome.ends ||
        (Array.isArray(outcome.ends) &&
          outcome.ends.length === record.biscuits.length &&
          outcome.ends.every(
            (point) =>
              Array.isArray(point) &&
              point.length === 3 &&
              point.every(Number.isFinite) &&
              [0, 1].includes(point[2]),
          ))) &&
      (!outcome.launch ||
        (Array.isArray(outcome.launch) &&
          outcome.launch.length === 2 &&
          outcome.launch.every(Number.isFinite)));

    if (
      (record.intended && !validOutcome(record.intended)) ||
      record.outcomes?.some((outcome) => !validOutcome(outcome))
    ) {
      return false;
    }

    if (
      record.bins &&
      (record.bins.some(
        (bin) =>
          typeof bin.key !== 'string' ||
          !record.summary.some((group) => group.score.join(',') === bin.key),
      ) ||
        record.biscuits.some(
          (_, index) =>
            record.bins
              .filter((bin) => bin.biscuit === index)
              .reduce((sum, bin) => sum + bin.count, 0) !== record.count,
        ))
    ) {
      return false;
    }

    return true;
  }

  function validRecord(record) {
    if (!record || record.version !== 1 || !record.state || !Array.isArray(record.biscuits)) {
      return false;
    }

    const state = record.state;
    const color = (value) => value === 'yellow' || value === 'black';
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);

    if (
      !color(state.color) ||
      !['head', 'foot'].includes(state.shootingEnd) ||
      !Array.isArray(state.discs) ||
      state.discs.length > 7 ||
      !state.court ||
      ![
        state.accuracy,
        state.angle,
        state.speed,
        state.position,
        state.launchY,
        state.court.slick,
        state.court.drift,
        state.court.threshold,
      ].every(finite) ||
      state.accuracy < 0 ||
      state.accuracy > 100 ||
      state.speed < 1 ||
      state.speed > 24 ||
      Math.abs(state.angle) > 20 ||
      state.position < 0 ||
      state.position > 100 ||
      state.court.slick < 0 ||
      state.court.slick > 100 ||
      Math.abs(state.court.drift) > 100 ||
      state.court.threshold < 0 ||
      (state.court.deceleration !== undefined &&
        (!finite(state.court.deceleration) ||
          state.court.deceleration <= 0 ||
          state.court.deceleration > 20)) ||
      typeof state.court.enabled !== 'boolean' ||
      (state.aimPoint && ![state.aimPoint.x, state.aimPoint.y].every(finite)) ||
      state.discs.some(
        (disc) =>
          !color(disc.color) ||
          ![
            disc.x,
            disc.y,
            disc.vx,
            disc.vy,
          ].every(finite),
      ) ||
      ['yellow', 'black'].some(
        (c) => state.discs.filter((disc) => disc.color === c).length > (c === state.color ? 3 : 4),
      )
    ) {
      return false;
    }

    const path = (p) =>
      Array.isArray(p) &&
      p.every((point) => Array.isArray(point) && point.length === 3 && point.every(finite));

    const paths = (p) =>
      p === undefined || (Array.isArray(p) && p.length === record.biscuits.length && p.every(path));

    const position = (p) =>
      Array.isArray(p) && p.length === 3 && p.every(finite) && [0, 1].includes(p[2]);

    const score = (s) => Array.isArray(s) && s.length === 2 && s.every(finite);

    if (
      record.biscuits.length !== state.discs.length + 1 ||
      record.biscuits.some((disc) => !color(disc.color) || ![disc.x, disc.y].every(finite)) ||
      !score(record.beforeScore) ||
      (record.intended &&
        (!score(record.intended.score) ||
          !paths(record.intended.paths) ||
          !Array.isArray(record.intended.positions) ||
          record.intended.positions.length !== record.biscuits.length ||
          !record.intended.positions.every(position))) ||
      !Number.isInteger(record.count) ||
      record.count < 1 ||
      record.count > 1000
    ) {
      return false;
    }

    if (record.storage === 'summary') {
      return (
        (record.selectionGroups === undefined ||
          (Array.isArray(record.selectionGroups) &&
            record.selectionGroups.every(
              (group) =>
                score(group.score) &&
                typeof group.key === 'string' &&
                group.key === group.score.join(',') + (group.key.endsWith('|1') ? '|1' : '|0') &&
                Number.isInteger(group.count) &&
                group.count > 0,
            ) &&
            record.selectionGroups.reduce((sum, group) => sum + group.count, 0) ===
              record.count)) &&
        Array.isArray(record.summary) &&
        Array.isArray(record.bins) &&
        record.summary.every(
          (row) => score(row.score) && Number.isInteger(row.count) && row.count > 0,
        ) &&
        record.summary.reduce((total, row) => total + row.count, 0) === record.count &&
        record.bins.every(
          (bin) =>
            position(bin.position) &&
            (bin.path === undefined || bin.path === null || path(bin.path)) &&
            (!record.selectionGroups ||
              record.selectionGroups.some((group) => group.key === bin.selectionKey)) &&
            Number.isInteger(bin.biscuit) &&
            bin.biscuit >= 0 &&
            bin.biscuit < record.biscuits.length &&
            Number.isInteger(bin.count) &&
            bin.count > 0,
        )
      );
    }

    return (
      Array.isArray(record.outcomes) &&
      record.outcomes.length === record.count &&
      record.outcomes.every(
        (outcome) =>
          score(outcome.score) &&
          paths(outcome.paths) &&
          (outcome.selfKitchen === undefined || typeof outcome.selfKitchen === 'boolean') &&
          Array.isArray(outcome.positions) &&
          outcome.positions.length === record.biscuits.length &&
          outcome.positions.every(position),
      )
    );
  }

  function write(storage, records) {
    try {
      storage.setItem(key, JSON.stringify(records));

      return records;
    } catch {
      const compact = records.map((entry) => ({ ...entry, record: model.summarize(entry.record) }));

      try {
        storage.setItem(key, JSON.stringify(compact));

        return compact;
      } catch {
        throw new Error(
          'Storage is full or unavailable. No saved shots were changed. Export or dele' +
            'te a saved shot and try again.',
        );
      }
    }
  }

  const api = {
    bytes,
    exportRecords,
    importRecords,
    limit: maxRecords,
    read,
    remove,
    rename,
    save,
    validRecord,
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    root.PredictionStorage = api;
  }
})(globalThis);
