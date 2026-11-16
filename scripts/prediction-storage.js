(function (root) {
  'use strict';

  const model =
    typeof module === 'undefined' ? root.PredictionModel : require('./prediction-model.js');

  const key = 'shotLab.predictions.v1';
  const fullLimit = 500 * 1024;

  function bytes(value) {
    return new TextEncoder().encode(JSON.stringify(value)).length;
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
      records.length > 20 ||
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

    if (records.length >= 20) {
      throw new Error('You have 20 saved shots. Delete one before saving another.');
    }

    let saved = bytes(record) < fullLimit ? structuredClone(record) : model.summarize(record);

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name.trim().slice(0, 120) || model.suggestedName(record),
      record: saved,
    };

    try {
      storage.setItem(key, JSON.stringify([...records, entry]));
    } catch {
      // Quotas vary by browser and origin. Try compact summaries atomically; never evict a saved shot.
      saved = model.summarize(record);
      entry.record = saved;
      try {
        storage.setItem(
          key,
          JSON.stringify([
            ...records.map((item) => ({ ...item, record: model.summarize(item.record) })),
            entry,
          ]),
        );
      } catch {
        throw new Error(
          'Storage is full or unavailable. Nothing was saved or deleted. Delete a save' +
            'd shot and try again.',
        );
      }
    }

    return { ...entry, bytes: bytes(saved) };
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
      state.speed > 18 ||
      Math.abs(state.angle) > 20 ||
      state.position < 0 ||
      state.position > 100 ||
      state.court.slick < 0 ||
      state.court.slick > 100 ||
      Math.abs(state.court.drift) > 100 ||
      state.court.threshold < 0 ||
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

    const position = (p) =>
      Array.isArray(p) && p.length === 3 && p.every(finite) && [0, 1].includes(p[2]);

    const score = (s) => Array.isArray(s) && s.length === 2 && s.every(finite);

    if (
      record.biscuits.length !== state.discs.length + 1 ||
      record.biscuits.some((disc) => !color(disc.color) || ![disc.x, disc.y].every(finite)) ||
      !score(record.beforeScore) ||
      (record.intended &&
        (!score(record.intended.score) ||
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
        Array.isArray(record.summary) &&
        Array.isArray(record.bins) &&
        record.summary.every(
          (row) => score(row.score) && Number.isInteger(row.count) && row.count > 0,
        ) &&
        record.summary.reduce((total, row) => total + row.count, 0) === record.count &&
        record.bins.every(
          (bin) =>
            position(bin.position) &&
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
          Array.isArray(outcome.positions) &&
          outcome.positions.length === record.biscuits.length &&
          outcome.positions.every(position),
      )
    );
  }

  const api = {
    bytes,
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
