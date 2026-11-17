/* Prediction records use physical feet from Head, independent of screen and shooting end. */
(function (root) {
  'use strict';
  const physics = typeof module === 'undefined' ? root.Physics : require('./physics.js');
  const legacyRoutes = new WeakMap();

  function deterministic(state) {
    return state.accuracy === 100 && (!state.court.enabled || state.speed <= state.court.threshold);
  }

  function groups(record) {
    if (record.summary) {
      return record.summary;
    }

    const rows = new Map();

    for (const outcome of record.outcomes) {
      const key = outcome.score.join(',');

      if (!rows.has(key)) {
        rows.set(key, { count: 0, score: outcome.score });
      }

      rows.get(key).count++;
    }

    return [...rows.values()].sort(
      (a, b) => b.count - a.count || a.score[0] - b.score[0] || a.score[1] - b.score[1],
    );
  }

  function intended(record) {
    if (record.intended?.paths) {
      return record.intended;
    }

    return trial({
      ...record,
      state: {
        ...record.state,
        accuracy: 100,
        court: { ...record.state.court, enabled: false },
      },
    });
  }

  function matches(key, filter) {
    return filter === '*' || filter.split(';').includes(key);
  }

  function physical(point, end) {
    return end === 'foot' ? physics.reversePoint(point) : point;
  }

  function points(record, scoreKey = '') {
    if (record.bins) {
      return record.bins.filter((bin) => !scoreKey || bin.key === scoreKey);
    }

    return record.outcomes
      .filter((outcome) => !scoreKey || outcome.score.join(',') === scoreKey)
      .flatMap((outcome) => {
        const key = selectionKey(record, outcome);
        let paths = outcome.paths;

        if (!paths && outcome.launch?.length === 2) {
          if (!legacyRoutes.has(outcome)) {
            // Old full saves retain the sampled launch, so their exact routes can be reconstructed.
            const result = trial({
              ...record,
              state: {
                ...record.state,
                accuracy: 100,
                angle: outcome.launch[0],
                court: { ...record.state.court, enabled: false },
                speed: outcome.launch[1],
              },
            });

            legacyRoutes.set(outcome, result.paths);
          }

          paths = legacyRoutes.get(outcome);
        }

        return outcome.positions.map((position, biscuit) => ({
          biscuit,
          count: 1,
          end: outcome.ends?.[biscuit] || null,
          key: outcome.score.join(','),
          path: paths?.[biscuit] || null,
          position,
          selectionKey: key,
        }));
      });
  }

  function prepare(snapshot) {
    const state = structuredClone(snapshot);

    state.paths = [];
    state.court.deceleration = physics.deceleration(state.court.slick);
    if (physics.remainingBiscuits(state.discs, state.color) === 0) {
      throw new Error('All four biscuits of this color are already used.');
    }

    const start = physics.startingPoint(
      state.color,
      state.position,
      state.launchY,
    );

    const counts = { black: 0, yellow: 0 };

    const biscuits = [
      ...state.discs,
      {
        ...start,
        color: state.color,
        id: 'prediction-shooter',
        out: false,
      },
    ].map((disc, index) => {
      const point = physical(disc, state.shootingEnd);
      const number = ++counts[disc.color];

      return {
        color: disc.color,
        id: disc.id,
        label: `${disc.color === 'yellow' ? 'Y' : 'B'}${number}`,
        out: !!disc.out,
        shooter: index === state.discs.length,
        x: point.x,
        y: point.y,
      };
    });

    /** @type {PredictionRecord} */
    const record = {
      beforeScore: totals(state.discs),
      biscuits,
      coordinateSystem: 'physical-feet-from-head',
      count: 0,
      createdAt: new Date().toISOString(),
      elapsedMs: 0,
      outcomes: [],
      state,
      version: 1,
    };

    record.intended = intended(record);

    return record;
  }

  function scenario(
    record,
    group,
    name,
  ) {
    if (name === 'self-kitchen') {
      return group.key.endsWith('|1');
    }

    const index = name.startsWith('yellow') ? 0 : 1;
    const change = group.score[index] - record.beforeScore[index];

    return name.endsWith('increases') ? change > 0 : change < 0;
  }

  function selectionGroups(record) {
    if (record.selectionGroups) {
      return record.selectionGroups;
    }

    if (!record.outcomes) {
      return record.summary.map((group) => ({ ...group, key: group.score.join(',') + '|0' }));
    }

    const groups = new Map();

    for (const outcome of record.outcomes) {
      const key = selectionKey(record, outcome);

      if (!groups.has(key)) {
        groups.set(key, {
          count: 0,
          key,
          score: outcome.score,
        });
      }

      groups.get(key).count++;
    }

    return [...groups.values()];
  }

  function selectionKey(record, outcome) {
    return outcome.score.join(',') + '|' + Number(selfKitchen(record, outcome));
  }

  function selfKitchen(record, outcome) {
    if (typeof outcome.selfKitchen === 'boolean') {
      return outcome.selfKitchen;
    }

    const index = record.biscuits.findIndex((disc) => disc.shooter);
    const position = outcome.ends?.[index] || outcome.positions[index];
    const point = physical({ x: position[0], y: position[1] }, record.state.shootingEnd);

    return physics.score({ ...point, out: !!position[2] }) === -10;
  }

  // Retain contacts and curved motion within 0.002 feet while collapsing straight travel.
  function simplifyPath(path) {
    if (path.length < 3) {
      return path;
    }

    const a = path[0],
      b = path[path.length - 1];

    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = dx * dx + dy * dy;

    let distance = 0.002,
      split = -1;

    for (let index = 1; index < path.length - 1; index++) {
      const p = path[index];

      const t = length
        ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
        : 0;

      const error = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);

      if (error > distance) {
        distance = error;
        split = index;
      }
    }

    return split < 0
      ? [a, b]
      : [
          ...simplifyPath(path.slice(0, split + 1)).slice(0, -1),
          ...simplifyPath(path.slice(split)),
        ];
  }

  function suggestedName(record) {
    const { state } = record;
    const outcome = intended(record);
    const shooter = record.biscuits.find((disc) => disc.shooter);
    const prefix = `${state.color === 'yellow' ? 'Yellow' : 'Black'} ${shooter.label.slice(1)}: `;

    const changes = record.biscuits.map((disc, index) => {
      const position = outcome.positions[index];
      const before = physical(disc, state.shootingEnd);
      const end = outcome.ends?.[index] || position;
      const after = physical({ x: end[0], y: end[1] }, state.shootingEnd);
      const startScore = disc.shooter ? 0 : physics.score({ ...before, out: disc.out });
      const endScore = physics.score({ ...after, out: !!position[2] });

      return {
        after,
        before,
        disc,
        endScore,
        moved: Math.hypot(after.x - before.x, after.y - before.y) > 0.05,
        out: !!position[2],
        startScore,
      };
    });

    const friendly = changes.filter((change) => change.disc.color === state.color);

    const opponents = changes.filter(
      (change) => change.disc.color !== state.color && !change.disc.out,
    );

    const label = (change) => {
      const color = change.disc.color === 'yellow' ? 'Yellow' : 'Black';

      return color + (change.startScore > 0 ? ` ${change.startScore}` : ' biscuit');
    };

    const replacement = (target) =>
      target.startScore > 0 &&
      friendly.find(
        (change) =>
          change.moved &&
          !change.out &&
          change.endScore === target.startScore &&
          change.after.x < 3 === target.before.x < 3 &&
          (change.startScore !== target.startScore ||
            change.before.x < 3 !== target.before.x < 3 ||
            Math.hypot(change.after.x - target.before.x, change.after.y - target.before.y) < 0.75),
      );

    const kitchened = opponents.find(
      (change) => change.startScore !== -10 && change.endScore === -10,
    );

    if (kitchened) {
      const replaced = replacement(kitchened);
      const via = replaced && !replaced.disc.shooter ? ` via ${replaced.disc.label}` : '';

      return prefix + (replaced ? 'replace & kitchen ' : 'kitchen ') + label(kitchened) + via;
    }

    const removed = opponents.find(
      (change) => change.moved && change.startScore > 0 && change.endScore <= 0,
    );

    if (removed) {
      const replaced = replacement(removed);
      const via = replaced && !replaced.disc.shooter ? ` via ${replaced.disc.label}` : '';

      return (
        prefix +
        (replaced ? 'replace ' : removed.out ? 'clear ' : 'dislodge ') +
        label(removed) +
        via
      );
    }

    const rescued = friendly.find(
      (change) =>
        !change.disc.shooter &&
        change.startScore === -10 &&
        change.endScore !== -10 &&
        change.moved,
    );

    if (rescued) {
      return (
        prefix +
        `rescue ${rescued.disc.label} from kitchen` +
        (rescued.endScore > 0 ? ` to ${rescued.endScore}` : '')
      );
    }

    const cue = changes.find((change) => change.disc.shooter);

    const bumped = friendly.find(
      (change) =>
        !change.disc.shooter &&
        change.moved &&
        change.endScore > 0 &&
        change.endScore > change.startScore,
    );

    if (bumped) {
      return (
        prefix +
        (cue.endScore > 0 ? 'double: ' : '') +
        `bump ${bumped.disc.label} to ${bumped.endScore}` +
        (cue.endScore > 0 ? ` & score ${cue.endScore}` : '')
      );
    }

    const cleared = opponents.find((change) => change.moved && change.out);

    if (cleared) {
      return prefix + `clear ${label(cleared)}`;
    }

    if (cue.endScore > 0) {
      return prefix + `draw to ${cue.endScore}`;
    }

    if (cue.endScore === -10) {
      return prefix + 'finish in kitchen';
    }

    const shifted = changes.find(
      (change) => !change.disc.shooter && !change.disc.out && change.moved,
    );

    return (
      prefix +
      (shifted
        ? `move ${shifted.disc.label}`
        : cue.out
          ? changes.every((change) => change.out)
            ? 'clear the court'
            : 'shoot off court'
          : cue.after.y < 28.5
            ? 'place a guard'
            : 'finish without a score')
    );
  }

  function summarize(record) {
    if (record.bins) {
      return structuredClone(record);
    }

    const bins = new Map();

    for (const point of points(record)) {
      const position = point.position.map((value, index) =>
        index < 2 ? Math.round(value * 10) / 10 : value,
      );

      const end = point.end
        ? point.end.map((value, index) => (index < 2 ? Math.round(value * 10) / 10 : value))
        : null;

      const path = point.path?.map((p) => p.map((v) => Math.round(v * 100) / 100)) || null;

      const key = JSON.stringify([
        point.selectionKey,
        point.biscuit,
        position,
        end,
        path,
      ]);

      if (!bins.has(key)) {
        bins.set(key, {
          ...point,
          count: 0,
          end,
          path,
          position,
        });
      }

      bins.get(key).count++;
    }

    const metadata = { ...record };

    delete metadata.outcomes;

    return {
      ...metadata,
      bins: [...bins.values()],
      selectionGroups: selectionGroups(record),
      storage: 'summary',
      summary: groups(record),
    };
  }

  function totals(discs) {
    return ['yellow', 'black'].map((color) =>
      discs
        .filter((disc) => disc.color === color)
        .reduce((sum, disc) => sum + physics.score(disc), 0),
    );
  }

  function trial(
    record,
    random = Math.random,
    capture = null,
  ) {
    const state = record.state;

    const start = physics.startingPoint(
      state.color,
      state.position,
      state.launchY,
    );

    const distance = state.aimPoint
      ? Math.hypot(state.aimPoint.x - start.x, state.aimPoint.y - start.y)
      : (33.1 - start.y) / Math.cos((state.angle * Math.PI) / 180);

    // Match a real shot: sample speed first, then use that speed for angular variance.
    const speed = physics.applyAccuracy(
      state.speed,
      state.accuracy,
      random,
    );

    const angle = physics.sampleAim(
      state.angle,
      state.accuracy,
      speed,
      distance,
      random,
      state.court,
    );

    const radians = (angle * Math.PI) / 180;
    const discs = structuredClone(state.discs);

    discs.push({
      ...start,
      color: state.color,
      out: false,
      vx: Math.sin(radians) * speed,
      vy: Math.cos(radians) * speed,
    });

    let elapsed = 0;

    const paths = discs.map((disc) => [
      [
        disc.x,
        disc.y,
        0,
      ],
    ]);

    const contact = (index, disc) => {
      paths[index].push([
        disc.x,
        disc.y,
        elapsed,
      ]);
    };

    let settled = false;

    capture?.(discs, 0);
    for (let step = 0; step < 240 * 100; step++) {
      elapsed = (step + 1) * physics.DT;

      physics.step(
        discs,
        physics.DT,
        // Legacy saves retain their original physical timing and outcomes.
        state.court.deceleration ?? 0.12 + 1.35 * (1 - state.court.slick / 100),
        state.court.drift * 0.00055,
        contact,
      );

      if ((step + 1) % 16 === 0) {
        discs.forEach((disc, index) => {
          if (!disc.out) {
            contact(index, disc);
          }
        });
      }

      if (capture && (step + 1) % 16 === 0) {
        capture(discs, elapsed);
      }

      if (discs.every((disc) => disc.out || Math.hypot(disc.vx, disc.vy) <= 0.00001)) {
        settled = true;
        break;
      }
    }

    discs.forEach((disc, index) => contact(index, disc));
    // Same settling and short-biscuit collection rules as simulation.finish().
    for (const disc of discs) {
      if (!disc.out && disc.y + physics.R < 25.5 - physics.LINE / 2) {
        disc.out = true;
      }
    }

    capture?.(discs, elapsed);

    const ends = discs.map((disc) => {
      const point = physical(disc, state.shootingEnd);

      return [
        point.x,
        point.y,
        disc.out ? 1 : 0,
      ];
    });

    physics.collectOffCourt(discs);

    return {
      ends,
      launch: [angle, speed],
      paths: paths.map((path) =>
        simplifyPath(path).map(
          ([
            x,
            y,
            time,
          ]) => {
            const point = physical({ x, y }, state.shootingEnd);

            return [
              Number(point.x.toFixed(4)),
              Number(point.y.toFixed(4)),
              Number(time.toFixed(4)),
            ];
          },
        ),
      ),
      positions: discs.map((disc) => {
        const point = physical(disc, state.shootingEnd);

        return [
          point.x,
          point.y,
          disc.out ? 1 : 0,
        ];
      }),
      score: totals(discs),
      selfKitchen: physics.score(discs[discs.length - 1]) === -10,
      settled,
    };
  }

  const api = {
    deterministic,
    groups,
    intended,
    matches,
    physical,
    points,
    prepare,
    scenario,
    selectionGroups,
    selectionKey,
    selfKitchen,
    suggestedName,
    summarize,
    trial,
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    root.PredictionModel = api;
  }
})(globalThis);
