/* exported
  aimAt,
  animate,
  finish,
  fire,
  scores,
  setup
*/
'use strict';

function aimAt(
  x,
  y,
  setSpeed = false,
) {
  const l = launch(),
    solution = setSpeed
      ? physics.targetShot(
          l,
          {
            x,
            y,
          },
          courtDeceleration(),
          drift(),
        )
      : {
          angle: (Math.atan2(x - l.x, y - l.y) * 180) / Math.PI,
        };

  element('angle').value = Math.max(-20, Math.min(20, solution.angle)).toFixed(2);
  if (setSpeed) {
    element('speed').value = Math.max(1, Math.min(18, solution.speed)).toFixed(2);
  }

  aimPoint = {
    x,
    y,
  };
}

function animate(stamp) {
  if (!running) {
    return;
  }

  if (!lastFrame) {
    lastFrame = stamp;
  }

  accumulator += Math.min((stamp - lastFrame) / 1000, 0.05) * 3;
  lastFrame = stamp;
  while (accumulator >= physics.DT) {
    physics.step(
      discs,
      physics.DT,
      courtDeceleration(),
      drift(),
    );

    accumulator -= physics.DT;
    time += physics.DT;
    if (Math.round(time / physics.DT) % 12 === 0) {
      discs.forEach((d, i) => {
        if (!d.out) {
          paths[i].push([d.x, d.y]);
        }
      });
    }

    if (discs.every((d) => !moving(d)) || time > 100) {
      finish();

      return;
    }
  }

  scores();
  draw();
  requestAnimationFrame(animate);
}

function finish() {
  running = false;

  const s = physics.score(shotDisc),
    isShort = !shotDisc.out && shotDisc.y + physics.R < 25.5 - physics.LINE / 2;

  for (const d of discs) {
    if (!d.out && d.y + physics.R < 25.5 - physics.LINE / 2) {
      d.out = true;
    }
  }

  element('result').textContent = shotDisc.out
    ? isShort
      ? 'Short of the dead line. Biscuit collected.'
      : 'Shooter collected behind the kitchen.'
    : s === -10
      ? 'Shooter in the kitchen. −10 points.'
      : s > 0
        ? `Shooter scores ${s}.`
        : 'Shooter in play, no score.';

  if (shotDisc.aimSigma > 0 || accuracy() < 100) {
    element('result').textContent +=
      ` Actual: ${shotDisc.launchSpeed.toFixed(2)} ft/s · ${shotDisc.launchAngle.toFixed(2)}°.`;
  }

  color = color === 'yellow' ? 'black' : 'yellow';
  if (aimPoint) {
    aimAt(
      aimPoint.x,
      aimPoint.y,
      true,
    );
  }

  update();
}

function fire(retry = false) {
  pendingSupplyColor = null;
  if (running || dragging) {
    return;
  }

  if (retry && lastShot) {
    restoreShot(lastShot);
    if (!lastShotUndone) {
      shotHistory.pop();
    }

    paths = [];
  }

  if (physics.remainingBiscuits(discs, color) === 0) {
    update();

    return;
  }

  const before = snapshot();

  shotHistory.push(before);
  lastShot = structuredClone(before);
  lastShotUndone = false;
  element('accuracy').value = accuracy().toFixed(1);
  shotDisc = shot(true);
  discs.push(shotDisc);
  paths = discs.map((d, i) => (paths[i]?.length ? paths[i] : [[d.x, d.y]]));
  running = true;
  time = 0;
  accumulator = 0;
  lastFrame = 0;

  element('result').textContent =
    shotDisc.aimSigma > 0 || accuracy() < 100
      ? `Actual launch: ${shotDisc.launchSpeed.toFixed(2)} ft/s · ${shotDisc.launchAngle.toFixed(2)}°.`
      : 'Watch the line and the contact.';

  update();
  requestAnimationFrame(animate);
}

function scores() {
  physics.collectOffCourt(discs);
  let yellow = 0,
    black = 0;

  for (const d of discs) {
    if (!d.out) {
      const s = physics.score(d);

      if (d.color === 'yellow') {
        yellow += s;
      } else {
        black += s;
      }
    }
  }

  element('yellowScore').textContent = String(yellow);
  element('blackScore').textContent = String(black);
}

function setup(name) {
  pendingSupplyColor = null;
  const [kind, guardColor = 'yellow'] = name.split('-');

  if (running) {
    return;
  }

  dragging = null;
  discs = [];
  shotHistory = [];
  lastShot = null;
  lastShotUndone = false;
  paths = [];
  color = 'yellow';
  launchY = 1.18;
  element('position').value = String(12);
  let x = 4.05,
    y = 33.1,
    travel = 0;

  if (kind === 'clear') {
    discs = [
      createDisc(
        3.9,
        33.2,
        'black',
      ),
    ];

    x = 4.22;
    y = 33.2;
    travel = 65;
  }

  if (kind === 'stpete') {
    color = guardColor;

    discs = [
      createDisc(
        color === 'black' ? 4.5 : 1.5,
        28.5,
        color,
      ),
    ];

    element('position').value = String(95);
    x = 1.48;
    y = 35.7;
  }

  if (kind === 'tampa') {
    color = guardColor;

    discs = [
      createDisc(
        color === 'black' ? 2.6 : 3.4,
        28.5,
        color,
      ),
    ];

    element('position').value = String(95);
    x = 4.25;
    y = 33.5;
  }

  if (kind === 'kitchen') {
    discs = [
      createDisc(
        4.05,
        33.3,
        'black',
      ),
    ];

    x = 4.05;
    y = 33.3;
    travel = 37;
  }

  if ((kind === 'stpete' || kind === 'tampa') && color === 'black') {
    x = 6 - x;
  }

  aimAt(x, y);

  element('speed').value = Math.sqrt(
    2 * courtDeceleration() * (travel || Math.hypot(x - launch().x, y - launch().y)),
  ).toFixed(2);

  queryElements('.setup').forEach((b) => {
    b.classList.toggle('active', b.dataset.setup === name);
    b.setAttribute('aria-pressed', String(b.dataset.setup === name));
  });

  element('result').textContent = 'Ready when you are.';
  update();
}
