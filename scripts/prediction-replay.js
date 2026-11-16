/* Compact, temporary motion data. Saved predictions retain launch values instead of animation frames. */
(function (root) {
  'use strict';

  const model =
    typeof module === 'undefined' ? root.PredictionModel : require('./prediction-model.js');

  const rate = 15;

  function build(record, outcome) {
    if (
      !Array.isArray(outcome.launch) ||
      outcome.launch.length !== 2 ||
      !outcome.launch.every(Number.isFinite)
    ) {
      throw new Error('This saved run has no delivery data. Regenerate to animate it.');
    }

    const values = [];
    const stride = record.biscuits.length * 3;
    let duration = -1;

    const capture = (discs, time) => {
      if (time === duration) {
        values.length -= stride;
      }

      duration = time;
      for (const disc of discs) {
        const point = model.physical(disc, record.state.shootingEnd);

        values.push(
          point.x,
          point.y,
          disc.out ? 1 : 0,
        );
      }
    };

    model.trial(
      {
        ...record,
        state: {
          ...record.state,
          accuracy: 100,
          angle: outcome.launch[0],
          court: { ...record.state.court, enabled: false },
          speed: outcome.launch[1],
        },
      },
      () => {
        throw new Error('Playback must never sample a new shot.');
      },
      capture,
    );

    return {
      duration,
      frames: new Float32Array(values),
      key: outcome.score.join(','),
      stride,
    };
  }

  function positions(track, time) {
    const frames = track.frames;
    const count = frames.length / track.stride;
    const frame = Math.min(Math.floor(Math.max(0, time) * rate), count - 1);
    const next = Math.min(frame + 1, count - 1);
    const end = next === count - 1 ? track.duration : next / rate;

    const blend =
      time >= track.duration
        ? 1
        : Math.max(0, Math.min(1, (time - frame / rate) / Math.max(1e-9, end - frame / rate)));

    return Array.from({ length: track.stride / 3 }, (_, biscuit) => {
      const a = frame * track.stride + biscuit * 3;
      const b = next * track.stride + biscuit * 3;

      return [
        frames[a] + (frames[b] - frames[a]) * blend,
        frames[a + 1] + (frames[b + 1] - frames[a + 1]) * blend,
        frames[blend < 1 ? a + 2 : b + 2],
      ];
    });
  }

  const api = { build, positions };

  if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    root.PredictionReplay = api;
  }
})(globalThis);
