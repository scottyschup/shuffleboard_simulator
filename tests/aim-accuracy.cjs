const assert = require('node:assert/strict'),
  P = require('../scripts/physics.js');

const noRandom = () => {
  throw Error('An exact shot must not sample aim');
};

for (const speed of [
  1,
  6,
  8,
]) {
  for (const angle of [
    -10,
    0,
    10,
  ]) {
    assert.equal(
      P.sampleAim(
        angle,
        100,
        speed,
        32,
        noRandom,
      ),
      angle,
    );
  }
}

const deterministic = () => {
  let i = 0;

  return () => [0.5, 0][i++];
};

assert.notEqual(
  P.sampleAim(
    0,
    95,
    6,
    32,
    deterministic(),
  ),
  0,
  'A straight shot varies below 100%',
);

assert.notEqual(
  P.sampleAim(
    0,
    100,
    18,
    32,
    deterministic(),
  ),
  0,
  'A hard shot varies at 100% base accuracy',
);

const offset0 = P.sampleAim(
    0,
    90,
    6,
    32,
    deterministic(),
  ),
  offset10 = P.sampleAim(
    10,
    90,
    6,
    32,
    deterministic(),
  );

assert.ok(
  Math.abs(offset10 - offset0 - 10) < 1e-12,
  'Error is additive and independent of nominal angle',
);

for (const distance of [
  20,
  32,
  38,
]) {
  const stats = P.aimStats(
    100,
    18,
    distance,
  );

  assert.ok(Math.abs(stats.missChance - 0.5) < 1e-6);

  assert.ok(
    P.aimStats(
      100,
      14,
      distance,
    ).missChance < 0.5,
  );

  assert.equal(
    P.aimStats(
      100,
      8,
      distance,
    ).sigmaDeg,
    0,
  );

  assert.ok(
    P.aimStats(
      100,
      8.01,
      distance,
    ).sigmaDeg > 0,
  );

  assert.ok(
    P.aimStats(
      100,
      22,
      distance,
    ).missChance > 0.5,
  );

  assert.ok(
    P.aimStats(
      90,
      18,
      distance,
    ).missChance > 0.5,
  );
}

let seed = 57231;

const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

  return seed / 4294967296;
};

let total = 0,
  totalSquared = 0,
  large = 0;

const n = 100000,
  expectedSigma = 0.3;

for (let i = 0; i < n; i++) {
  const angle = P.sampleAim(
    0,
    95,
    6,
    32,
    random,
  );

  total += angle;
  totalSquared += angle * angle;
  if (Math.abs(angle) > 3 * expectedSigma) {
    large++;
  }
}

assert.ok(Math.abs(total / n) < 0.005, 'Gaussian error is centered');

assert.ok(
  Math.abs(Math.sqrt(totalSquared / n) - expectedSigma) < 0.005,
  'Gaussian spread matches skill setting',
);

assert.ok(large > 150 && large < 400, 'High accuracy still has occasional larger misses');
// End-to-end calibration against an actual stationary 6-inch biscuit.
let misses = 0;

const trials = 6000,
  start = { x: 3, y: 1.18 },
  distance = 33 - start.y;

for (let i = 0; i < trials; i++) {
  const angle =
    (P.sampleAim(
      0,
      100,
      18,
      distance,
      random,
    ) *
      Math.PI) /
    180;

  const result = P.simulate(
    [
      {
        ...start,
        out: false,
        vx: 18 * Math.sin(angle),
        vy: 18 * Math.cos(angle),
      },
      {
        out: false,
        vx: 0,
        vy: 0,
        x: 3,
        y: 33,
      },
    ],
    0.66,
  );

  const target = result.discs[1];

  if (target.x === 3 && target.y === 33 && !target.out) {
    misses++;
  }
}

const rate = misses / trials;

assert.ok(rate > 0.47 && rate < 0.53, `Physical collision miss rate ${rate}`);

console.log(
  'PASS: additive Gaussian aim, zero-angle variation, speed penalty ' +
    'above 8 ft/s, rare larger errors, and ' +
    `${(100 * rate).toFixed(2)}` +
    '% physical misses at 18 ft/s (' +
    `${trials}` +
    ' shots).',
);

const disabledFastError = { enabled: false, threshold: 8 };

assert.equal(
  P.aimStats(
    100,
    18,
    32,
    disabledFastError,
  ).sigmaDeg,
  0,
);

assert.equal(
  P.sampleAim(
    3,
    100,
    18,
    32,
    noRandom,
    disabledFastError,
  ),
  3,
);

assert.ok(
  P.aimStats(
    90,
    18,
    32,
    disabledFastError,
  ).skillSigmaDeg > 0,
);

const higherThreshold = { enabled: true, threshold: 9.5 };

assert.equal(
  P.aimStats(
    100,
    9.5,
    32,
    higherThreshold,
  ).speedSigmaDeg,
  0,
);

assert.ok(
  P.aimStats(
    100,
    9.6,
    32,
    higherThreshold,
  ).speedSigmaDeg > 0,
);

assert.ok(
  Math.abs(
    P.aimStats(
      100,
      19.5,
      32,
      higherThreshold,
    ).missChance - 0.5,
  ) < 1e-6,
);

console.log(
  'PASS: fast-shot switch, fractional thresholds, retained skill error, and shifted calibration.',
);
