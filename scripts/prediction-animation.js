/* exported
  PredictionAnimation
*/
/* All trials share a delivery clock; physics is prepared in batches, never run inside a paint frame. */
const PredictionAnimation = (() => {
  'use strict';
  const memoryLimit = 48 * 1024 * 1024;
  let record = null;
  let tracks = [];
  let intendedTrack = null;
  let token = 0;
  let preparing = false;
  let playing = false;
  let blocked = false;
  let time = 0;
  let duration = 0;
  let lastStamp = null;
  let lastPaint = 0;
  let paintTotal = 0;
  let paints = 0;
  let draw = () => {};

  function configure(next, disabled = false) {
    if (next !== record) {
      stop();
      record = next;
      tracks = [];
      intendedTrack = null;
      element('predictionAnimationStatus').textContent = '';
      element('predictionAnimationTime').textContent = '';
    }

    blocked = disabled;
    updateButton();
  }

  function initialize(onDraw) {
    draw = onDraw;

    element('animatePrediction').onclick = () => {
      if (playing || preparing) {
        stop();
        draw();
      } else {
        play();
      }
    };
  }

  async function play() {
    if (!record || blocked || !record.outcomes) {
      return;
    }

    const current = ++token;
    const source = record;

    preparing = true;
    updateButton();
    try {
      if (!tracks.length) {
        const prepared = [];
        let bytes = 0;
        let chunk = performance.now();

        for (const outcome of source.outcomes) {
          const track = PredictionReplay.build(source, outcome);

          bytes += track.frames.byteLength;
          if (bytes > memoryLimit) {
            throw new Error(
              'This run is too large to animate smoothly. Static results remain available.',
            );
          }

          prepared.push(track);
          if (performance.now() - chunk > 12) {
            element('predictionAnimationStatus').textContent =
              `Preparing delivery ${prepared.length} / ${source.count}…`;

            await new Promise((resolve) => setTimeout(resolve, 0));
            if (current !== token) {
              return;
            }

            chunk = performance.now();
          }
        }

        if (current !== token) {
          return;
        }

        tracks = prepared;
        intendedTrack = PredictionReplay.build(source, PredictionModel.intended(source));
      }

      preparing = false;
      playing = true;
      time = 0;
      lastStamp = null;
      lastPaint = 0;
      paints = 0;
      paintTotal = 0;
      duration = Math.max(...tracks.map((track) => track.duration), intendedTrack.duration);

      element('predictionAnimationStatus').textContent =
        `Playing all ${source.count} deliveries together at 1× speed.`;

      updateButton();
      draw();
      requestAnimationFrame((stamp) => tick(stamp, current));
    } catch (error) {
      if (current === token) {
        tracks = [];
        preparing = false;
        playing = false;
        element('predictionAnimationStatus').textContent = error.message;
        updateButton();
      }
    }
  }

  function points(source, filter) {
    if (!playing || source !== record) {
      return null;
    }

    const keys = filter ? filter.split(';') : [];
    let selected = tracks.filter((track) => !keys.length || keys.includes(track.key));

    if (!selected.length && keys.includes(intendedTrack?.key)) {
      selected = [intendedTrack];
    }

    return selected.flatMap((track) =>
      PredictionReplay.positions(track, time).map((position, biscuit) => ({
        biscuit,
        count: 1,
        end: position,
        key: track.key,
        position,
      })),
    );
  }

  function stop() {
    token++;
    const active = playing || preparing;

    preparing = false;
    playing = false;
    if (active) {
      element('predictionAnimationStatus').textContent = 'Delivery stopped. Showing final results.';
    }

    updateButton();
  }

  function tick(stamp, current) {
    if (current !== token || !playing) {
      return;
    }

    if (lastStamp === null) {
      lastStamp = stamp;
    }

    // A background tab pauses delivery rather than jumping over the contacts on return.
    time = Math.min(duration, time + Math.min(0.1, (stamp - lastStamp) / 1000));
    lastStamp = stamp;
    const interval = paints && paintTotal / paints > 12 ? 1000 / 30 : 1000 / 60;

    if (stamp - lastPaint >= interval || time >= duration) {
      const start = performance.now();

      draw();
      paintTotal += performance.now() - start;
      paints++;
      lastPaint = stamp;
      element('predictionCourt').dataset.animationFrameMs = (paintTotal / paints).toFixed(2);

      element('predictionAnimationTime').textContent =
        `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
    }

    if (time >= duration) {
      playing = false;

      element('predictionAnimationStatus').textContent =
        'Delivery complete. Showing final results.';

      updateButton();
      draw();

      return;
    }

    requestAnimationFrame((next) => tick(next, current));
  }

  function updateButton() {
    const button = element('animatePrediction');

    if (!button) {
      return;
    }

    button.disabled = blocked || !record?.outcomes;
    button.textContent = playing || preparing ? 'Stop animation' : 'Animate all shots';
    button.setAttribute('aria-pressed', String(playing || preparing));

    button.title =
      record && !record.outcomes
        ? 'Regenerate compact results to animate individual shots'
        : 'Play every sampled shot together without changing its launch or outcome';
  }

  return {
    configure,
    initialize,
    play,
    points,
    stop,
  };
})();
