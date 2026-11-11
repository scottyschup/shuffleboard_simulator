/* exported
  canvasSize,
  courtPoint,
  draw,
  render,
  update
*/
'use strict';

function canvasSize(c) {
  const b = c.getBoundingClientRect(),
    ratio = Math.min(window.devicePixelRatio || 1, 2);

  if (c.width !== Math.round(b.width * ratio) || c.height !== Math.round(b.height * ratio)) {
    c.width = Math.round(b.width * ratio);
    c.height = Math.round(b.height * ratio);
  }

  const ctx = c.getContext('2d');

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0,
  );

  ctx.clearRect(
    0,
    0,
    b.width,
    b.height,
  );

  return {
    ctx,
    h: b.height,
    w: b.width,
  };
}

function courtPoint(event, id) {
  const b = element(id).getBoundingClientRect(),
    v = viewMaps[id];

  if (!v) {
    return null;
  }

  const xx = event.clientX - b.left,
    yy = event.clientY - b.top;

  return v.unmap(xx, yy);
}

function draw() {
  render('overview', false);
  render('target', true);
  render('shooting', true);
  updateSupply();
}

function render(id, zoom) {
  const {
    ctx,
    w,
    h,
  } = canvasSize(element(id));

  if (w < 1 || h < 1) {
    return;
  }

  const transverse = zoom ? 6.4 : 7;
  const padding = 12;
  const isShooting = id === 'shooting';
  const mirrorX = zoom && shootingEnd === 'foot';
  const reverse = !zoom && shootingEnd === 'foot';
  const rotation = id === 'target' ? ((h >= w ? 0 : 1) + focusRotation) % 4 : 0;
  const vertical = rotation % 2 === 0;
  const yMin = isShooting ? -0.35 : zoom ? focusStart : -2.25;

  const yMax = isShooting
    ? Math.max(1.9, (h - 12) / ((w - 12) / transverse) - 0.35)
    : zoom
      ? focusStart + focusLength
      : 41.25;

  const length = yMax - yMin;

  // One scale for both axes preserves court and biscuit proportions.
  const scale = Math.max(
    0.01,
    vertical
      ? Math.min((w - padding) / transverse, (h - 16) / length)
      : Math.min((w - 16) / length, (h - padding) / transverse),
  );

  const centerY = (yMin + yMax) / 2;

  // Quarter-turn axes keep drawing and pointer conversion exact inverses.
  const axes = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];

  const [axisX, axisY] = axes[rotation];

  const map = (x, y) => {
    if (mirrorX) {
      x = 6 - x;
    }

    if (reverse) {
      y = 39 - y;
    }

    const across = (x - 3) * scale;
    const along = (centerY - y) * scale;

    return [w / 2 + axisX * across - axisY * along, h / 2 + axisY * across + axisX * along];
  };

  const unmap = (xx, yy) => {
    const across = (xx - w / 2) / scale;
    const along = (yy - h / 2) / scale;
    const x = 3 + axisX * across + axisY * along;
    const y = centerY + axisY * across - axisX * along;

    return {
      x: mirrorX ? 6 - x : x,
      y: reverse ? 39 - y : y,
    };
  };

  viewMaps[id] = {
    map,
    rotation,
    scale,
    unmap,
    vertical,
  };

  const line = (
    points,
    stroke = '#e5e9cf',
    width = physics.LINE * scale,
    dash = [],
  ) => {
    ctx.beginPath();

    points.forEach((p, i) => {
      const q = map(...p);

      i ? ctx.lineTo(...q) : ctx.moveTo(...q);
    });

    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const rect = (
    x,
    y,
    ww,
    hh,
    fill,
  ) => {
    const p = map(x, y),
      q = map(x + ww, y + hh);

    ctx.fillStyle = fill;

    ctx.fillRect(
      Math.min(p[0], q[0]),
      Math.min(p[1], q[1]),
      Math.abs(q[0] - p[0]),
      Math.abs(q[1] - p[1]),
    );
  };

  const text = (
    str,
    x,
    y,
    size = 12,
    fill = '#e3e8ce',
  ) => {
    const q = map(x, y);

    ctx.fillStyle = fill;
    ctx.font = `500 ${size}px 'DM Sans',sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, ...q);
  };

  // A full-width slab and muted apron: no walls or table-shuffleboard cushions.
  rect(
    -0.16,
    0,
    6.32,
    39,
    '#c7cebd',
  );

  rect(
    0,
    0,
    6,
    39,
    '#476d56',
  );

  rect(
    0,
    39.15,
    6,
    1.85,
    '#dce3d4',
  );

  text(
    'COLLECTED',
    3,
    40.7,
    zoom ? 9 : 6,
    '#637568',
  );

  rect(
    0,
    37.5,
    6,
    1.5,
    '#395a48',
  );

  {
    rect(
      0,
      0,
      6,
      1.5,
      '#395a48',
    );
  }
  ctx.save();

  const tl = map(-0.5, yMax),
    br = map(6.5, yMin);

  ctx.beginPath();

  ctx.rect(
    Math.min(tl[0], br[0]),
    Math.min(tl[1], br[1]),
    Math.abs(br[0] - tl[0]),
    Math.abs(br[1] - tl[1]),
  );

  ctx.clip();
  for (let n = 0; n < 39; n++) {
    line(
      [
        [0, n],
        [6, n],
      ],
      '#ffffff05',
      0.5,
    );
  }

  function triangle(reverse = false) {
    const y = (v) => (reverse ? 39 - v : v);

    physics.diagramLines.forEach((points) => line(points.map(([x, yy]) => [x, y(yy)])));
    const fs = zoom ? 18 : Math.max(7, scale * 0.55);

    text(
      '10',
      3,
      y(30.45),
      fs,
    );

    text(
      '8',
      2.25,
      y(33),
      fs,
    );

    text(
      '8',
      3.75,
      y(33),
      fs,
    );

    text(
      '7',
      1.6,
      y(36),
      fs,
    );

    text(
      '7',
      4.4,
      y(36),
      fs,
    );

    if (zoom) {
      text(
        '−10',
        1.5,
        y(38.25),
        15,
      );

      text(
        '−10',
        4.5,
        y(38.25),
        15,
      );
    } else {
      text(
        '−10',
        1.5,
        y(38.25),
        7,
      );

      text(
        '−10',
        4.5,
        y(38.25),
        7,
      );
    }
  }

  triangle();
  triangle(true);

  line(
    [
      [0, 25.5],
      [6, 25.5],
    ],
    '#e5e9cf',
    Math.max(0.8, physics.LINE * scale),
  );

  if (!zoom) {
    line(
      [
        [0, 13.5],
        [6, 13.5],
      ],
      '#e5e9cf',
      Math.max(0.8, physics.LINE * scale),
    );
  }

  if (zoom) {
    text(
      'DEAD LINE',
      3,
      25.1,
      8,
      '#bcccb3',
    );
  }

  if (element('trails').checked) {
    paths.forEach((path, i) => {
      if (path.length > 1) {
        line(
          path,
          discs[i]?.color === 'black' ? '#c3cec399' : '#edcb6ea6',
          zoom ? 1.8 : 1.1,
        );
      }
    });
  }

  if (!running) {
    const l = launch(),
      r = (value('angle') * Math.PI) / 180;

    line(
      [
        [l.x, l.y],
        [l.x + Math.sin(r) * 48, l.y + Math.cos(r) * 48],
      ],
      '#dce8bd66',
      zoom ? 1 : 1,
      [4, 5],
    );

    if (element('prediction').checked && preview) {
      preview.paths.forEach((path, i) => {
        const start = path[0],
          end = preview.discs[i],
          isShooter = i === preview.paths.length - 1;

        if (!isShooter && !path.some((p) => Math.hypot(p[0] - start[0], p[1] - start[1]) > 0.005)) {
          return;
        }

        const ink = isShooter ? '#e3ed9c' : end.color === 'black' ? '#b9dafa' : '#ffd17a';

        line(
          path,
          ink,
          zoom ? 1.8 : 1.2,
          [5, 5],
        );

        const q = map(end.x, end.y);

        ctx.beginPath();

        ctx.arc(
          ...q,
          physics.R * scale,
          0,
          Math.PI * 2,
        );

        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }

  for (const d of discs) {
    if (d.out && !d.parked) {
      continue;
    }

    const q = map(d.x, d.y),
      radius = physics.R * scale;

    ctx.shadowColor = '#162e3180';
    ctx.shadowBlur = zoom ? 5 : 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();

    ctx.arc(
      ...q,
      radius,
      0,
      Math.PI * 2,
    );

    ctx.fillStyle = d.color === 'yellow' ? '#edc559' : '#202e29';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = d.color === 'yellow' ? '#ba9437' : '#111f19';
    ctx.lineWidth = Math.max(1, scale * 0.025);
    ctx.stroke();
    ctx.beginPath();

    ctx.arc(
      ...q,
      radius * 0.63,
      0,
      Math.PI * 2,
    );

    ctx.strokeStyle = d.color === 'yellow' ? '#f8df8d' : '#53665a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (zoom && physics.score(d)) {
      text(
        String(physics.score(d)),
        d.x,
        d.y,
        Math.max(8, scale * 0.19),
        d.color === 'yellow' ? '#5b4a24' : '#d5dfd3',
      );
    }
  }

  if (!running) {
    const l = launch(),
      q = map(l.x, l.y);

    ctx.beginPath();

    ctx.arc(
      ...q,
      physics.R * scale,
      0,
      Math.PI * 2,
    );

    ctx.fillStyle =
      physics.remainingBiscuits(discs, color) === 0
        ? '#9aa19b'
        : color === 'yellow'
          ? '#f0cf6a'
          : '#1d2b25';

    ctx.fill();
    ctx.strokeStyle = '#fff9';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (!running && aimPoint) {
    const q = map(aimPoint.x, aimPoint.y);

    ctx.strokeStyle = '#eef5ba';
    ctx.lineWidth = 1;
    ctx.beginPath();

    ctx.arc(
      ...q,
      zoom ? 7 : 3,
      0,
      Math.PI * 2,
    );

    ctx.moveTo(q[0] - (zoom ? 11 : 5), q[1]);
    ctx.lineTo(q[0] + (zoom ? 11 : 5), q[1]);
    ctx.moveTo(q[0], q[1] - (zoom ? 11 : 5));
    ctx.lineTo(q[0], q[1] + (zoom ? 11 : 5));
    ctx.stroke();
  }

  ctx.restore();
  if (!zoom) {
    const top = map(0, focusStart);
    const bottom = map(6, focusStart + focusLength);

    ctx.fillStyle = '#ffffff20';
    ctx.strokeStyle = '#f8f7d8';
    ctx.lineWidth = 2;

    ctx.fillRect(
      Math.min(top[0], bottom[0]),
      Math.min(top[1], bottom[1]),
      Math.abs(bottom[0] - top[0]),
      Math.abs(bottom[1] - top[1]),
    );

    ctx.strokeRect(
      Math.min(top[0], bottom[0]),
      Math.min(top[1], bottom[1]),
      Math.abs(bottom[0] - top[0]),
      Math.abs(bottom[1] - top[1]),
    );
  }

  if (isShooting) {
    const shooter = map(launch().x, launch().y);
    const courtLeft = Math.min(map(0, 0)[0], map(6, 0)[0]);
    const halfCourtWidth = 3 * scale;

    element('controlPanel').style.width = halfCourtWidth + 'px';

    element('controlPanel').style.left =
      (shooter[0] > w / 2 ? courtLeft : courtLeft + halfCourtWidth) + 'px';
  }

  if (dragging?.kind === 'supply' && dragging.id === id && dragging.point) {
    const p = dragging.point,
      q = map(p.x, p.y);

    ctx.beginPath();

    ctx.arc(
      ...q,
      physics.R * scale,
      0,
      2 * Math.PI,
    );

    ctx.fillStyle = dragging.color === 'yellow' ? '#edc559' : '#202e29';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = canDrop(p) ? '#b7d69e' : '#b75239';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function update() {
  element('angleVal').textContent = `${value('angle') > 0 ? '+' : ''}${value('angle').toFixed(2)}°`;
  element('speedVal').textContent = `${value('speed').toFixed(2)} ft/s`;
  element('slickVal').textContent = `${value('slick')} / 100`;

  const spread = physics.aimStats(
    accuracy(),
    value('speed'),
    aimDistance(),
    fastShotOptions(),
  );

  element('aimSpread').textContent =
    `σ ${spread.sigmaDeg.toFixed(2)}° · miss ${(100 * spread.missChance).toFixed(1)}%`;

  element('aimSpread').setAttribute(
    'aria-label',
    'Aim standard deviation ' +
      `${spread.sigmaDeg.toFixed(2)}` +
      ' degrees. Estimated miss rate ' +
      `${(100 * spread.missChance).toFixed(1)}` +
      ' percent for a virtual six-inch target biscuit at the selected ra' +
      'nge, without drift or other collisions.',
  );

  element('driftVal').textContent =
    value('drift') === 0
      ? 'None'
      : `${Math.abs(value('drift'))}% ${value('drift') < 0 ? 'left' : 'right'}`;

  ['yellow', 'black'].forEach((c) => {
    element(c).classList.toggle('selected', color === c);
    element(c).setAttribute('aria-pressed', String(color === c));
  });

  for (const end of ['head', 'foot']) {
    element(end + 'End').setAttribute('aria-pressed', String(shootingEnd === end));
    button(end + 'End').disabled = running || !!dragging;
  }

  element('scoringHeading').textContent =
    'Focus view · ' + (shootingEnd === 'head' ? 'toward Foot' : 'toward Head');

  element('target').setAttribute(
    'aria-label',
    'Magnified court, feet ' +
      focusStart.toFixed(1) +
      ' to ' +
      (focusStart + focusLength).toFixed(1) +
      '. Tap to aim or drag unlocked biscuits.',
  );

  element('undo').disabled = running || !!dragging || !shotHistory.length;
  element('retry').disabled = running || !!dragging || !lastShot;
  element('fastShotThreshold').disabled = running || !element('fastShotInaccuracy').checked;
  element('biscuitLock').disabled = running || !!dragging;
  element('reset').disabled = running || !!dragging;
  element('rotateFocus').disabled = !!dragging;
  element('biscuitLock').setAttribute('aria-pressed', String(biscuitsLocked));

  element('biscuitLock').setAttribute(
    'aria-label',
    biscuitsLocked ? 'Unlock biscuits' : 'Lock biscuits',
  );

  element('biscuitLock').textContent = biscuitsLocked ? '🔒' : '🔓';
  element('biscuitLock').title = biscuitsLocked ? 'Unlock biscuits' : 'Lock biscuits';
  const canShoot = physics.remainingBiscuits(discs, color) > 0;

  element('shoot').disabled = running || !canShoot;

  element('shoot').title = canShoot
    ? 'Shoot the queued biscuit'
    : 'All four ' + color + ' biscuits are used';

  queryElements(
    '#controlPanel button, #controlPanel input, #settingsDialog input, .shot-actions button',
  ).forEach((el) => {
    /** @type {HTMLButtonElement} */ (el).disabled = running || !!dragging;
  });

  element('shoot').disabled = running || !!dragging || !canShoot;
  element('undo').disabled = running || !!dragging || !shotHistory.length;
  element('retry').disabled = running || !!dragging || !lastShot;
  element('predictOutcomes').disabled = true;

  element('placePigeon').disabled =
    running ||
    !!dragging ||
    physics.remainingBiscuits(
      discs,
      color,
      color,
    ) === 0;

  element('fastShotThreshold').disabled = running || !element('fastShotInaccuracy').checked;
  if (!running && canShoot) {
    preview = physics.simulate(
      [...structuredClone(discs.filter((d) => !d.out)), shot()],
      courtDeceleration(),
      drift(),
    );
  }

  if (!running && !canShoot) {
    preview = null;
  }

  scores();
  draw();
}
