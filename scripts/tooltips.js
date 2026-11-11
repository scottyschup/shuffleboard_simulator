/* exported
  closeTooltips,
  initializeTooltips
*/
'use strict';
const tooltipEntries = [];

function closeTooltips() {
  for (const entry of tooltipEntries) {
    entry.pinned = false;
    setTooltip(entry, false);
  }
}

function initializeTooltips() {
  queryElements('.info-button').forEach((trigger) => {
    const container = trigger.parentElement;
    const tooltip = document.getElementById(trigger.getAttribute('aria-describedby'));

    if (!tooltip) {
      return;
    }

    const entry = {
      container,
      pinned: false,
      tooltip,
      trigger,
    };

    tooltipEntries.push(entry);

    trigger.onclick = () => {
      const next = !entry.pinned;

      closeTooltips();
      entry.pinned = next;
      setTooltip(entry, next);
    };

    container.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') {
        setTooltip(entry, true);
      }
    });

    container.addEventListener('pointerleave', () => {
      if (!entry.pinned && !container.contains(document.activeElement)) {
        setTooltip(entry, false);
      }
    });

    trigger.addEventListener('focus', () => setTooltip(entry, true));

    container.addEventListener('focusout', (event) => {
      if (!container.contains(/** @type {Node} */ (event.relatedTarget))) {
        entry.pinned = false;
        setTooltip(entry, false);
      }
    });
  });

  const dismissOutside = (event) => {
    for (const entry of tooltipEntries) {
      if (!entry.container.contains(event.target)) {
        entry.pinned = false;
        setTooltip(entry, false);
      }
    }
  };

  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('click', dismissOutside);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTooltips();
    }
  });
}

function setTooltip(entry, open) {
  entry.container.classList.toggle('open', open);
  entry.tooltip.hidden = !open;
  entry.trigger.setAttribute('aria-expanded', String(open));
}
