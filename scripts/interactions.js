/* exported
  endDrag,
  isSecondaryPointer,
  moveBiscuit,
  pointerDown,
  positionShooter,
  selectShootingEnd,
  switchShooter
*/
'use strict';

function endDrag(
  e,
  id,
  cancel = false,
) {
  if (
    !dragging ||
    dragging.id !== id ||
    dragging.pointerId !== e.pointerId ||
    (!cancel && isSecondaryPointer(e))
  ) {
    return;
  }

  const drag = dragging;

  dragging = null;
  if (drag.kind === 'shooter' && cancel) {
    restoreShot(drag.before);
  }

  if (drag.kind === 'disc') {
    const point = courtPoint(e, id);
    const destination = { x: point.x + drag.dx, y: point.y + drag.dy };

    if (cancel) {
      discs[discs.indexOf(drag.disc)] = structuredClone(drag.before);
    } else if (isOffCourt(destination)) {
      discs = discs.filter((disc) => disc !== drag.disc);
      saveArrangement();
      element('result').textContent = 'Biscuit returned to supply.';
    } else if (canDrop(destination, drag.disc)) {
      Object.assign(drag.disc, {
        ...destination,
        out: false,
        parked: false,
      });

      saveArrangement();
    } else {
      discs[discs.indexOf(drag.disc)] = structuredClone(drag.before);
    }
  }

  if (drag.kind === 'supply') {
    drag.button.classList.remove('dragging');
    const p = courtPoint(e, id);

    if (
      !cancel &&
      canDrop(p) &&
      physics.remainingBiscuits(
        discs,
        drag.color,
        color,
      ) > 0
    ) {
      saveArrangement();

      discs.push(
        createDisc(
          p.x,
          p.y,
          drag.color,
        ),
      );

      element('result').textContent = 'Biscuit placed. Drag to rearrange.';
    }
  }

  update();
}

function isOffCourt(point) {
  return point.x < 0 || point.x > 6 || point.y < 0 || point.y > 39;
}

function isSecondaryPointer(e) {
  return e.pointerType !== 'touch' && e.button > 0;
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

  const x = p.x + dragging.dx;
  const y = p.y + dragging.dy;

  if (isOffCourt({ x, y }) || canDrop({ x, y }, dragging.disc)) {
    Object.assign(dragging.disc, {
      out: false,
      parked: false,
      x,
      y,
    });
  }

  update();
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
        before: snapshot(),
        dx: l.x - p.x,
        dy: l.y - p.y,
        id,
        kind: 'shooter',
        pointerId: e.pointerId,
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

  if (hit && !(id === 'target' && biscuitsLocked)) {
    dragging = {
      before: structuredClone(hit),
      disc: hit,
      dx: hit.x - p.x,
      dy: hit.y - p.y,
      id,
      kind: 'disc',
      pointerId: e.pointerId,
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

function selectShootingEnd(next) {
  if (running || dragging || next === shootingEnd) {
    return;
  }

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

element('headEnd').onclick = () => selectShootingEnd('head');
element('footEnd').onclick = () => selectShootingEnd('foot');
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
          (id === 'target' && biscuitsLocked) ||
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
          button: b,
          color: c,
          id,
          kind: 'supply',
          point: null,
          pointerId: e.pointerId,
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
