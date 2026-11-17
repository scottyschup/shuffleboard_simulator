/* exported
  PredictionAnimation
*/
/* Prepare physics once; playback, pause, speed and seeking only read the sampled tracks. */
const PredictionAnimation = (() => {
  'use strict';
  const memoryLimit = 48 * 1024 * 1024;
  let record = null,
    tracks = [],
    token = 0,
    preparing = false,
    playing = false,
    active = false;
  let blocked = false,
    time = 0,
    duration = 0,
    speed = 1,
    lastStamp = null,
    lastPaint = 0;
  let paintTotal = 0,
    paints = 0,
    draw = () => {},
    allSelected = true,
    hasSelection = true;
  let autoFraming = false;

  function configure(next, disabled = false) {
    if (next !== record) {
      stop();
      record = next;
      tracks = [];
      duration = 0;
      time = 0;
      element('predictionAnimationStatus').textContent = '';
    }

    blocked = disabled;
    updateControls();
  }

  function framing(source, filter) {
    if (!autoFraming || source !== record) {
      return null;
    }

    if (preparing) {
      return 'full';
    }

    if (!active) {
      return null;
    }

    let entry = Infinity;

    for (const track of tracks) {
      if (PredictionModel.matches(track.selectionKey, filter)) {
        entry = Math.min(entry, track.scoringEntry);
      }
    }

    return time >= entry ? 'receiving' : 'full';
  }

  function initialize(onDraw) {
    draw = onDraw;
    element('animatePrediction').onclick = () => (playing || preparing ? pause() : play());
    element('predictionReplaySlower').onclick = () => setSpeed(speed / 2);
    element('predictionReplayFaster').onclick = () => setSpeed(speed * 2);

    element('predictionReplaySeek').addEventListener('input', () =>
      seek(Number(input('predictionReplaySeek').value)),
    );

    updateControls();
  }

  function manualView() {
    autoFraming = false;
  }

  function pause() {
    token++;
    const cancelled = preparing;

    preparing = false;
    playing = false;
    lastStamp = null;

    element('predictionAnimationStatus').textContent = cancelled
      ? 'Replay preparation cancelled.'
      : 'Replay paused.';

    updateControls();
    draw();
  }

  async function play() {
    if (!record?.outcomes || blocked || playing || preparing || !hasSelection) {
      return;
    }

    const current = ++token,
      source = record;

    preparing = !tracks.length;
    autoFraming = true;
    updateControls();
    draw();
    try {
      if (!tracks.length) {
        const prepared = [];
        let bytes = 0,
          chunk = performance.now();

        for (const outcome of source.outcomes) {
          const track = PredictionReplay.build(source, outcome);

          bytes += track.frames.byteLength;
          if (bytes > memoryLimit) {
            throw new Error(
              'This run is too large to replay smoothly. Static results remain available.',
            );
          }

          prepared.push(track);
          if (performance.now() - chunk > 12) {
            element('predictionAnimationStatus').textContent =
              'Preparing replay ' + prepared.length + ' / ' + source.count + '…';

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
        duration = Math.max(0, ...tracks.map((track) => track.duration));
      }

      preparing = false;
      if (!active || time >= duration) {
        time = 0;
      }

      active = true;
      playing = true;
      lastStamp = null;
      lastPaint = 0;
      paints = 0;
      paintTotal = 0;

      element('predictionAnimationStatus').textContent =
        'Playing ' + (allSelected ? 'all' : 'selected') + ' deliveries together.';

      updateControls();
      draw();
      requestAnimationFrame((stamp) => tick(stamp, current));
    } catch (error) {
      if (current === token) {
        tracks = [];
        preparing = false;
        playing = false;
        active = false;
        autoFraming = false;
        element('predictionAnimationStatus').textContent = error.message;
        updateControls();
        draw();
      }
    }
  }

  function points(source, filter) {
    if (!active || source !== record) {
      return null;
    }

    return tracks
      .filter((track) => PredictionModel.matches(track.selectionKey, filter))
      .flatMap((track) =>
        PredictionReplay.positions(track, time).map((position, biscuit) => ({
          biscuit,
          count: 1,
          end: position,
          key: track.key,
          path: PredictionReplay.path(
            track,
            biscuit,
            time,
            position,
          ),
          position,
        })),
      );
  }

  function seek(value) {
    if (!tracks.length || blocked || !Number.isFinite(value)) {
      return;
    }

    token++;
    preparing = false;
    playing = false;
    active = true;
    lastStamp = null;
    time = Math.max(0, Math.min(duration, value));

    element('predictionAnimationStatus').textContent =
      'Replay paused. Drag the timeline or press Play to resume.';

    updateControls();
    draw();
  }

  function selection(all, any) {
    allSelected = all;
    hasSelection = any;
    updateControls();
  }

  function setSpeed(value) {
    if (!Number.isFinite(value)) {
      return;
    }

    speed = Math.max(0.25, Math.min(4, value));
    updateControls();
  }

  function stop() {
    token++;
    const wasActive = active || preparing;

    preparing = false;
    playing = false;
    active = false;
    autoFraming = false;
    lastStamp = null;
    if (tracks.length) {
      time = duration;
    }

    if (wasActive) {
      element('predictionAnimationStatus').textContent = 'Replay stopped. Showing final results.';
    }

    updateControls();
  }

  function tick(stamp, current) {
    if (current !== token || !playing) {
      return;
    }

    if (lastStamp === null) {
      lastStamp = stamp;
    }

    time = Math.min(duration, time + Math.min(0.1, (stamp - lastStamp) / 1000) * speed);
    lastStamp = stamp;
    const interval = paints && paintTotal / paints > 12 ? 1000 / 30 : 1000 / 60;

    if (stamp - lastPaint >= interval || time >= duration) {
      const start = performance.now();

      draw();
      paintTotal += performance.now() - start;
      paints++;
      lastPaint = stamp;
      element('predictionCourt').dataset.animationFrameMs = (paintTotal / paints).toFixed(2);
      updateClock();
    }

    if (time >= duration) {
      playing = false;
      element('predictionAnimationStatus').textContent = 'Replay complete.';
      updateControls();
      draw();

      return;
    }

    requestAnimationFrame((next) => tick(next, current));
  }

  function updateClock() {
    const milliseconds = Math.round(time * 1000),
      seconds = Math.floor(milliseconds / 1000),
      fraction = milliseconds % 1000;

    element('predictionAnimationTime').textContent =
      String(seconds).padStart(2, '0') + '.' + String(fraction).padStart(3, '0');

    element('predictionAnimationTime').setAttribute(
      'aria-label',
      seconds + ' seconds ' + fraction + ' milliseconds',
    );

    input('predictionReplaySeek').value = String(time);

    element('predictionReplaySeek').setAttribute(
      'aria-valuetext',
      time.toFixed(3) + ' of ' + duration.toFixed(3) + ' seconds',
    );
  }

  function updateControls() {
    const available = !!record?.outcomes && !blocked;
    const running = playing || preparing;

    element('animatePrediction').disabled = !available || (!running && !hasSelection);

    const label = running
      ? preparing
        ? 'Cancel replay preparation'
        : 'Pause replay'
      : 'Play ' + (allSelected ? 'all' : 'selected') + ' shots';

    element('animatePrediction').textContent = running ? '⏸️' : '▶️';
    element('animatePrediction').setAttribute('aria-label', label);
    element('animatePrediction').setAttribute('aria-pressed', String(running));

    element('animatePrediction').title =
      record && !record.outcomes ? 'Regenerate compact results to replay individual shots' : label;

    element('predictionReplaySlower').disabled = !available || speed <= 0.25;
    element('predictionReplayFaster').disabled = !available || speed >= 4;
    element('predictionReplaySpeed').textContent = speed + '×';
    element('predictionReplaySeek').disabled = !available || !tracks.length || preparing;
    input('predictionReplaySeek').max = String(duration);

    element('predictionReplaySeek').title = tracks.length
      ? 'Scrub the replay; press Play to resume'
      : 'Play once to prepare the replay timeline';

    updateClock();
  }

  return {
    configure,
    framing,
    initialize,
    manualView,
    pause,
    play,
    points,
    seek,
    selection,
    setSpeed,
    stop,
  };
})();
