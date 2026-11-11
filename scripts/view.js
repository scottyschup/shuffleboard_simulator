/* exported
  update,
  canvasSize,
  render,
  draw,
  courtPoint
*/
'use strict';
function update() {
  element('angleVal').textContent = `${value('angle') > 0 ? '+' : ''}${value('angle').toFixed(2)}°`;
  element('speedVal').textContent = `${value('speed').toFixed(2)} ft/s`;
  element('slickVal').textContent = `${value('slick')} / 100`;
  const spread = physics.aimStats(
    accuracy(
      'aimAccuracy',
    ),
    value(
      'speed',
    ),
    aimDistance(),
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
    shootingEnd === 'head' ? 'The scoring end · Foot' : 'The scoring end · Head';
  element('target').setAttribute(
    'aria-label',
    `${shootingEnd === 'head' ? 'Foot' : 'Head'}` +
      ' scoring end. Click to set aim and launch speed, or drag biscuits' +
      '.',
  );
  element('undo').disabled = running || !shotHistory.length;
  element('retry').disabled = running || !redoHistory.length;
  const canShoot = physics.remainingBiscuits(discs, color) > 0;
  element('shoot').disabled = running || !canShoot;
  element('shoot').textContent = 'Shoot disc';
  element('shoot').title = canShoot
    ? 'Shoot the queued biscuit'
    : 'All four ' + color + ' biscuits are used';
  queryElements(
    '.controls select,.controls input,.controls .setup,.color-picker ' +
      'button,#left,#right,#speedDown,#speedUp,#reset',
  ).forEach((el) => {
    /** @type {HTMLButtonElement} */ (el).disabled = running;
  });
  if (!running && canShoot) {
    preview = physics.simulate(
      [
        ...structuredClone(
          discs.filter(
            (
              d,
            ) =>
              !d.out,
          ),
        ),
        shot(),
      ],
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
    w: b.width,
    h: b.height,
  };
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
  const transverse = 8,
    padding = 16;
  const mirrorX = zoom && shootingEnd === 'foot',
    reverse = !zoom && shootingEnd === 'foot',
    vertical = zoom ? h > w / 1.4 : h > w,
    yMin = zoom ? 24.75 : reverse ? -2.25 : -0.5,
    yMax = reverse ? 39.5 : 41.25,
    length = yMax - yMin;
  // One scale for both axes preserves court and biscuit proportions.
  const scale = Math.max(
    0.01,
    vertical
      ? Math.min((w - padding) / transverse, (h - 16) / length)
      : Math.min((w - 16) / length, (h - padding) / transverse),
  );
  const x0 = vertical ? (w - 6 * scale) / 2 : (w - length * scale) / 2 - yMin * scale;
  const y0 = vertical ? (h - length * scale) / 2 : (h - 6 * scale) / 2;
  const map = (x, y) => {
    if (mirrorX) {
      x = 6 - x;
    }
    if (reverse) {
      y = 39 - y;
    }
    return vertical ? [x0 + x * scale, y0 + (yMax - y) * scale] : [x0 + y * scale, y0 + x * scale];
  };
  viewMaps[id] = {
    map,
    scale,
    x0,
    y0,
    vertical,
    yMax,
    reverse,
    mirrorX,
  };
  for (const c of ['black', 'yellow']) {
    const left = physics.remainingBiscuits(
      discs,
      c,
      running
        ? null
        : color,
    );
    for (let slot = 0; slot < 4; slot++) {
      const b = button(id + 'Supply' + c + (slot || '')),
        q = map(
          c === 'black' ? -0.65 : 6.65,
          25.7 + slot * Math.min(3.7, Math.max(0.7, 26 / scale)),
        );
      b.hidden = slot >= left;
      b.disabled = running || slot >= left;
      b.style.left = q[0] + 'px';
      b.style.top = q[1] + 'px';
      b.style.setProperty('--disc-size', 2 * physics.R * scale + 'px');
      b.style.setProperty('--hit-size', Math.max(24, 2 * physics.R * scale) + 'px');
      b.setAttribute(
        'aria-label',
        `${c === 'black' ? 'Black' : 'Yellow'} remaining biscuit ${slot + 1} of ${left}. Drag onto court.`,
      );
      b.title = 'Drag a ' + c + ' biscuit onto the court';
    }
  }
  if (id === 'overview') {
    const from = shootingEnd === 'head' ? 'Head' : 'Foot',
      to = shootingEnd === 'head' ? 'Foot' : 'Head';
    element(id).setAttribute(
      'aria-label',
      'Full court overview. Shooting from ' +
        `${from}` +
        ' toward ' +
        `${to}` +
        '. Drag the queued biscuit at the shooting end; click the opposite' +
        ' starting side to switch color.',
    );
    const captions = queryElements('.court-caption span');
    captions[0].textContent = vertical
      ? `HEAD ↓ / FOOT ↑ · SHOOT FROM ${from.toUpperCase()}`
      : `HEAD / ${shootingEnd === 'head' ? 'SHOOTING' : 'SCORING'} END`;
    captions[1].textContent = vertical
      ? 'Tap to aim · drag biscuits'
      : 'FOOT / ' +
        `${shootingEnd === 'foot' ? 'SHOOTING' : 'SCORING'}` +
        ' END ' +
        `${shootingEnd === 'head' ? '→' : '←'}`;
  }
  const line = (
    points,
    stroke = '#e5e9cf',
    width = physics.LINE *
      scale,
    dash = [],
  ) => {
    ctx.beginPath();
    points.forEach(
      (
        p,
        i,
      ) => {
        const q =
          map(
            ...p,
          );
        i
          ? ctx.lineTo(
              ...q,
            )
          : ctx.moveTo(
              ...q,
            );
      },
    );
    ctx.strokeStyle =
      stroke;
    ctx.lineWidth =
      width;
    ctx.setLineDash(
      dash,
    );
    ctx.stroke();
    ctx.setLineDash(
      [],
    );
  };
  const rect = (
    x,
    y,
    ww,
    hh,
    fill,
  ) => {
    const p =
        map(
          x,
          y,
        ),
      q =
        map(
          x +
            ww,
          y +
            hh,
        );
    ctx.fillStyle =
      fill;
    ctx.fillRect(
      Math.min(
        p[0],
        q[0],
      ),
      Math.min(
        p[1],
        q[1],
      ),
      Math.abs(
        q[0] -
          p[0],
      ),
      Math.abs(
        q[1] -
          p[1],
      ),
    );
  };
  const text = (
    str,
    x,
    y,
    size = 12,
    fill = '#e3e8ce',
  ) => {
    const q =
      map(
        x,
        y,
      );
    ctx.fillStyle =
      fill;
    ctx.font = `500 ${size}px 'DM Sans',sans-serif`;
    ctx.textAlign =
      'center';
    ctx.textBaseline =
      'middle';
    ctx.fillText(
      str,
      ...q,
    );
  };
  // A full-width slab and muted apron: no walls or table-shuffleboard cushions.
  rect(
    -0.16,
    zoom
      ? 24.75
      : 0,
    6.32,
    zoom
      ? 14.25
      : 39,
    '#c7cebd',
  );
  rect(
    0,
    zoom
      ? 24.75
      : 0,
    6,
    zoom
      ? 14.25
      : 39,
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
    zoom
      ? 9
      : 6,
    '#637568',
  );
  rect(
    0,
    37.5,
    6,
    1.5,
    '#395a48',
  );
  if (!zoom) {
    rect(
      0,
      0,
      6,
      1.5,
      '#395a48',
    );
  }
  ctx.save();
  const tl = map(-0.5, 41.25),
    br = map(6.5, zoom ? 24.75 : -0.5);
  ctx.beginPath();
  ctx.rect(
    Math.min(
      tl[0],
      br[0],
    ),
    Math.min(
      tl[1],
      br[1],
    ),
    Math.abs(
      br[0] -
        tl[0],
    ),
    Math.abs(
      br[1] -
        tl[1],
    ),
  );
  ctx.clip();
  for (let n = 0; n < 39; n++) {
    line(
      [
        [
          0,
          n,
        ],
        [
          6,
          n,
        ],
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
      y(
        30.45,
      ),
      fs,
    );
    text(
      '8',
      2.25,
      y(
        33,
      ),
      fs,
    );
    text(
      '8',
      3.75,
      y(
        33,
      ),
      fs,
    );
    text(
      '7',
      1.6,
      y(
        36,
      ),
      fs,
    );
    text(
      '7',
      4.4,
      y(
        36,
      ),
      fs,
    );
    if (zoom) {
      text(
        '−10',
        1.5,
        y(
          38.25,
        ),
        15,
      );
      text(
        '−10',
        4.5,
        y(
          38.25,
        ),
        15,
      );
    } else {
      text(
        '−10',
        1.5,
        y(
          38.25,
        ),
        7,
      );
      text(
        '−10',
        4.5,
        y(
          38.25,
        ),
        7,
      );
    }
  }
  triangle();
  if (!zoom) {
    triangle(true);
  }
  line(
    [
      [
        0, 25.5,
      ],
      [
        6, 25.5,
      ],
    ],
    '#e5e9cf',
    Math.max(
      0.8,
      physics.LINE *
        scale,
    ),
  );
  if (!zoom) {
    line(
      [
        [
          0, 13.5,
        ],
        [
          6, 13.5,
        ],
      ],
      '#e5e9cf',
      Math.max(
        0.8,
        physics.LINE *
          scale,
      ),
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
          discs[
            i
          ]
            ?.color ===
            'black'
            ? '#c3cec399'
            : '#edcb6ea6',
          zoom
            ? 1.8
            : 1.1,
        );
      }
    });
  }
  if (!running) {
    const l = launch(),
      r = (value('angle') * Math.PI) / 180;
    line(
      [
        [
          l.x,
          l.y,
        ],
        [
          l.x +
            Math.sin(
              r,
            ) *
              48,
          l.y +
            Math.cos(
              r,
            ) *
              48,
        ],
      ],
      '#dce8bd66',
      zoom
        ? 1
        : 1,
      [
        4, 5,
      ],
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
          zoom
            ? 1.8
            : 1.2,
          [
            5, 5,
          ],
        );
        const q = map(end.x, end.y);
        ctx.beginPath();
        ctx.arc(
          ...q,
          physics.R *
            scale,
          0,
          Math.PI *
            2,
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
      Math.PI *
        2,
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
      radius *
        0.63,
      0,
      Math.PI *
        2,
    );
    ctx.strokeStyle = d.color === 'yellow' ? '#f8df8d' : '#53665a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (zoom && physics.score(d)) {
      text(
        String(
          physics.score(
            d,
          ),
        ),
        d.x,
        d.y,
        Math.max(
          8,
          scale *
            0.19,
        ),
        d.color ===
          'yellow'
          ? '#5b4a24'
          : '#d5dfd3',
      );
    }
  }
  if (!running && !zoom) {
    const l = launch(),
      q = map(l.x, l.y);
    ctx.beginPath();
    ctx.arc(
      ...q,
      physics.R *
        scale,
      0,
      Math.PI *
        2,
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
      zoom
        ? 7
        : 3,
      0,
      Math.PI *
        2,
    );
    ctx.moveTo(q[0] - (zoom ? 11 : 5), q[1]);
    ctx.lineTo(q[0] + (zoom ? 11 : 5), q[1]);
    ctx.moveTo(q[0], q[1] - (zoom ? 11 : 5));
    ctx.lineTo(q[0], q[1] + (zoom ? 11 : 5));
    ctx.stroke();
  }
  ctx.restore();
  if (dragging?.kind === 'supply' && dragging.id === id && dragging.point) {
    const p = dragging.point,
      q = map(p.x, p.y);
    ctx.beginPath();
    ctx.arc(
      ...q,
      physics.R *
        scale,
      0,
      2 *
        Math.PI,
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
function draw() {
  render('overview', false);
  render('target', true);
}
function courtPoint(event, id) {
  const b = element(id).getBoundingClientRect(),
    v = viewMaps[id];
  if (!v) {
    return null;
  }
  const xx = event.clientX - b.left,
    yy = event.clientY - b.top;
  const p = {
    x: v.vertical ? (xx - v.x0) / v.scale : (yy - v.y0) / v.scale,
    y: v.vertical ? v.yMax - (yy - v.y0) / v.scale : (xx - v.x0) / v.scale,
  };
  if (v.mirrorX) {
    p.x = 6 - p.x;
  }
  if (v.reverse) {
    p.y = 39 - p.y;
  }
  return p;
}
