/* exported
  selectShootingEnd,
  positionShooter,
  switchShooter,
  isSecondaryPointer,
  pointerDown,
  moveBiscuit,
  endDrag
*/
'use strict';
function selectShootingEnd(next) {
  if (running || dragging || next === shootingEnd) {
    return;
  }
  shotHistory.push(snapshot());
  redoHistory = [];
  discs.forEach((d) => {
    Object.assign(d, physics.reversePoint(d));
    d.vy = -d.vy;
  });
  paths = paths.map((path) =>
    path.map(([x, y]) => {
      const p = physics.reversePoint({ x, y });
      return [p.x, p.y];
    }),
  );
  shootingEnd = next;
  lastShot = null;
  aimPoint = null;

  queryElements('.setup').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', String('false'));
  });
  element('angle').value = String(0);
  element('speed').value = Math.sqrt(2 * courtDeceleration() * (33.1 - launch().y)).toFixed(2);
  element('result').textContent =
    `Ready to shoot from the ${next === 'head' ? 'Head toward the Foot' : 'Foot toward the Head'}.`;
  update();
}
element('headEnd').onclick = () => selectShootingEnd('head');
element('footEnd').onclick = () => selectShootingEnd('foot');
function positionShooter(x, y) {
  const next = physics.startingPosition(
    color,
    x,
    y,
  );
  launchY = next.y;
  element('position').value = String(next.position);
  if (aimPoint) {
    aimAt(
      aimPoint.x,
      aimPoint.y,
      true,
    );
  }
  update();
}
function switchShooter(next) {
  if (running) {
    return;
  }
  color = next;
  if (aimPoint) {
    aimAt(
      aimPoint.x,
      aimPoint.y,
      true,
    );
  }
  update();
}
function isSecondaryPointer(e) {
  return e.pointerType !== 'touch' && e.button > 0;
}
function pointerDown(e, id) {
  if (isSecondaryPointer(e) || running || dragging) {
    return;
  }
  e.preventDefault();
  const p = courtPoint(e, id);
  if (!p) {
    return;
  }
  if (id === 'overview' && p.x >= 0 && p.x <= 6 && p.y >= 0 && p.y <= 1.5) {
    const side = p.x < 3 ? 'black' : 'yellow';
    if (side !== color) {
      switchShooter(side);
      positionShooter(p.x, p.y);
      return;
    }
    const l = launch();
    if (
      physics.remainingBiscuits(discs, color) > 0 &&
      Math.hypot(l.x - p.x, l.y - p.y) <= Math.max(physics.R, 14 / viewMaps[id].scale)
    ) {
      dragging = {
        kind: 'shooter',
        id,
        pointerId:
          e.pointerId,
        dx:
          l.x -
          p.x,
        dy:
          l.y -
          p.y,
        before:
          snapshot(),
      };
      element(id).setPointerCapture(e.pointerId);
      return;
    }
  }

  const hit = discs.findLast(
    (d) =>
      (!d.out || d.parked) &&
      Math.hypot(d.x - p.x, d.y - p.y) <= Math.max(physics.R, 12 / viewMaps[id].scale),
  );
  if (hit) {
    saveArrangement();
    dragging = {
      kind: 'disc',
      disc: hit,
      id,
      pointerId:
        e.pointerId,
      dx:
        hit.x -
        p.x,
      dy:
        hit.y -
        p.y,
    };
    element(id).setPointerCapture(e.pointerId);
    return;
  }
  if (p.x < -0.24 || p.x > 6.24 || p.y < 0 || p.y > 39) {
    return;
  }
  if (p.y >= 20) {
    aimAt(
      p.x,
      p.y,
      true,
    );
    update();
  }
}
function moveBiscuit(e, id) {
  if (!dragging || dragging.id !== id || dragging.pointerId !== e.pointerId) {
    return;
  }
  const p = courtPoint(e, id);
  if (dragging.kind === 'shooter') {
    positionShooter(p.x + dragging.dx, p.y + dragging.dy);
    return;
  }
  if (dragging.kind === 'supply') {
    dragging.point = p;
    draw();
    return;
  }
  const x = Math.max(-0.24, Math.min(6.24, p.x + dragging.dx)),
    y = Math.max(0, Math.min(39, p.y + dragging.dy));
  if (!canDrop({ x, y }, dragging.disc)) {
    return;
  }
  Object.assign(dragging.disc, {
    x,
    y,
    out: false,
    parked: false,
  });
  update();
}
function endDrag(
  e,
  id,
  cancel = false,
) {
  if (
    !dragging ||
    dragging.id !==
      id ||
    dragging.pointerId !==
      e.pointerId ||
    (!cancel &&
      isSecondaryPointer(
        e,
      ))
  ) {
    return;
  }
  const drag =
    dragging;
  dragging =
    null;
  if (
    drag.kind ===
      'shooter' &&
    cancel
  ) {
    restoreShot(
      drag.before,
    );
  }
  if (
    drag.kind ===
    'supply'
  ) {
    drag.button.classList.remove(
      'dragging',
    );
    const p =
      courtPoint(
        e,
        id,
      );
    if (
      !cancel &&
      canDrop(
        p,
      ) &&
      physics.remainingBiscuits(
        discs,
        drag.color,
        color,
      ) >
        0
    ) {
      saveArrangement();
      discs.push(
        createDisc(
          p.x,
          p.y,
          drag.color,
        ),
      );
      element(
        'result',
      ).textContent =
        'Biscuit placed. Drag to rearrange.';
    }
  }
  update();
}
for (const id of ['overview', 'target']) {
  const canvas = element(id);
  for (const c of ['black', 'yellow']) {
    for (let slot = 0; slot < 4; slot++) {
      const b = document.createElement('button');
      b.id = id + 'Supply' + c + (slot || '');
      b.className = 'biscuit-supply ' + c;
      b.dataset.color = c;
      b.type = 'button';
      b.innerHTML = '<span aria-hidden="true"></span>';
      canvas.parentElement.append(b);
      b.addEventListener('pointerdown', (e) => {
        if (
          isSecondaryPointer(e) ||
          running ||
          dragging ||
          physics.remainingBiscuits(
            discs,
            c,
            color,
          ) === 0
        ) {
          return;
        }
        e.preventDefault();
        dragging = {
          kind: 'supply',
          color:
            c,
          id,
          pointerId:
            e.pointerId,
          button:
            b,
          point:
            null,
        };
        b.classList.add('dragging');
        b.setPointerCapture(e.pointerId);
      });
      b.addEventListener('pointermove', (e) => moveBiscuit(e, id));
      b.addEventListener('pointerup', (e) => endDrag(e, id));
      for (const ev of ['pointercancel', 'lostpointercapture']) {
        b.addEventListener(ev, (e) =>
          endDrag(
            e,
            id,
            true,
          ),
        );
      }
    }
  }
  canvas.addEventListener('pointerdown', (e) => pointerDown(e, id));
  canvas.addEventListener('pointermove', (e) => moveBiscuit(e, id));
  canvas.addEventListener('pointerup', (e) => endDrag(e, id));
  for (const ev of ['pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(ev, (e) =>
      endDrag(
        e,
        id,
        true,
      ),
    );
  }
}
