/* exported
  findDropView,
  initializeSupply,
  placeSupply,
  supplyButtons,
  supplyOrder,
  suppressSupplyClick,
  updateSupply
*/
'use strict';
const supplyButtons = [];
let suppressSupplyClick = false;

function armSupply(nextColor) {
  pendingSupplyColor = nextColor;

  element('result').textContent = 'Tap a magnified court to place the ' + nextColor + ' biscuit. Escape cancels.';
}

function findDropView(event) {
  for (const id of ['shooting', 'target']) {
    const rect = element(id).getBoundingClientRect();

    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return id;
    }
  }

  return null;
}

function initializeSupply() {
  for (let index = 0; index < 8; index++) {
    const supply = document.createElement('button');

    supply.id = 'supply' + index;
    supply.type = 'button';
    supply.className = 'supply-biscuit';
    supply.innerHTML = '<span aria-hidden="true"></span>';
    element('supplyColumn').append(supply);
    supplyButtons.push(supply);

    supply.onclick = (event) => {
      if (suppressSupplyClick && event?.detail !== 0) {
        suppressSupplyClick = false;

        return;
      }

      if (running) {
        return;
      }

      suppressSupplyClick = false;
      armSupply(supply.dataset.color);
    };

    supply.addEventListener('pointerdown', (event) => {
      if (running || dragging || isSecondaryPointer(event)) {
        return;
      }

      event.preventDefault();
      pendingSupplyColor = null;

      dragging = {
        button: supply,
        color: supply.dataset.color,
        id: 'target',
        kind: 'supply',
        moved: false,
        point: null,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };

      supply.setPointerCapture(event.pointerId);
      supply.classList.add('dragging');
    });

    supply.addEventListener('pointermove', (event) => {
      if (dragging?.kind !== 'supply' || dragging.pointerId !== event.pointerId) {
        return;
      }

      const id = findDropView(event);

      dragging.moved ||= Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 4;

      dragging.id = id || 'target';
      dragging.point = id ? courtPoint(event, id) : null;
      draw();
    });

    const release = (event, cancel = false) => {
      if (dragging?.kind !== 'supply' || dragging.pointerId !== event.pointerId) {
        return;
      }

      const drag = dragging;

      dragging = null;
      supply.classList.remove('dragging');
      const id = findDropView(event);

      if (!cancel && id) {
        const point = courtPoint(event, id);

        if (isOffCourt(point)) {
          placeSupply(drag.color, { x: 3, y: 39 + 1.5 * physics.R }, 'collection');
        } else {
          placeSupply(drag.color, point, id);
        }
      } else if (!cancel && !drag.moved) {
        armSupply(drag.color);
      } else if (!cancel && !isQueueDrop(event)) {
        placeSupply(drag.color, { x: 3, y: 39 + 1.5 * physics.R }, 'collection');
      }

      suppressSupplyClick = true;
      update();
    };

    supply.addEventListener('pointerup', (event) => release(event));
    for (const name of ['lostpointercapture', 'pointercancel']) {
      supply.addEventListener(name, (event) => release(event, true));
    }
  }
}

function placeSupply(biscuitColor, point, id) {
  if (
    running ||
    (id === 'target' && biscuitsLocked) ||
    !canDrop(point) ||
    physics.remainingBiscuits(discs, biscuitColor, color) === 0
  ) {
    return false;
  }

  const own = physics.remainingBiscuits(discs, color, color);

  const otherColor = color === 'yellow' ? 'black' : 'yellow';
  const other = physics.remainingBiscuits(discs, otherColor);
  // Compare the queued column before pulling; keep the separate shooter reserved.
  const next = biscuitColor === color && own > other ? otherColor : color;

  saveArrangement();

  discs.push(createDisc(point.x, point.y, biscuitColor));

  if (isCollectionPoint(point)) {
    Object.assign(discs[discs.length - 1], { out: true, parked: true });
  }

  pendingSupplyColor = null;
  switchShooter(next);
  element('result').textContent = 'Biscuit placed. ' + color + ' shoots next.';

  return true;
}

function supplyOrder() {
  const remaining = {
    black: physics.remainingBiscuits(discs, 'black', running ? null : color),
    yellow: physics.remainingBiscuits(discs, 'yellow', running ? null : color),
  };

  let next =
    remaining.black === remaining.yellow
      ? color === 'yellow'
        ? 'black'
        : 'yellow'
      : remaining.black > remaining.yellow
        ? 'black'
        : 'yellow';
  const order = [];

  while (remaining.black + remaining.yellow > 0) {
    if (!remaining[next]) {
      next = next === 'yellow' ? 'black' : 'yellow';
    }

    order.push(next);
    remaining[next]--;
    next = next === 'yellow' ? 'black' : 'yellow';
  }

  return order;
}

function updateSupply() {
  const order = supplyOrder();

  supplyButtons.forEach((supply, index) => {
    supply.hidden = index >= order.length;
    supply.disabled = running || (!!dragging && dragging.button !== supply);
    supply.dataset.color = order[index] || '';

    supply.className = 'supply-biscuit ' + (order[index] || '') + (dragging?.button === supply ? ' dragging' : '');

    supply.style.setProperty('--disc-size', 2 * physics.R * (viewMaps.target?.scale || 40) + 'px');

    supply.setAttribute(
      'aria-label',
      (order[index] || '') +
        ' biscuit ' +
        (index + 1) +
        ' of ' +
        order.length +
        '. Drag to a magnified court, or select then tap to place.',
    );
  });
}
