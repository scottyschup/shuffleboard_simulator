// Exercise the real application pointer handlers with mouse and emulated-touch
// event shapes, using a minimal DOM/canvas fixture (no browser dependencies).
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');

const elements = [],
  ids = new Map(),
  documentListeners = {};

function element(tag = 'div') {
  const el = {
    addEventListener(k, fn) {
      (this.listeners[k] ??= []).push(fn);
    },
    append(b) {
      b.parentElement = this;
      this.children.push(b);
    },
    attributes: {},
    children: [],
    className: '',
    close() {
      this.open = false;
    },
    dataset: {},
    disabled: false,
    getAttribute(k) {
      return this.attributes[k] ?? null;
    },
    getBoundingClientRect() {
      return {
        height: this.id === 'overview' ? 150 : 600,
        left: 0,
        top: 0,
        width: this.id === 'overview' ? 800 : 500,
      };
    },
    getContext() {
      return new Proxy(
        {},
        {
          get: () => () => {},
        },
      );
    },
    height: 0,
    listeners: {},
    setAttribute(k, v) {
      this.attributes[k] = String(v);
    },
    setPointerCapture() {},
    showModal() {
      this.open = true;
    },
    style: {
      setProperty(k, v) {
        this[k] = v;
      },
    },
    tagName: tag.toUpperCase(),
    value: '',
    width: 0,
  };

  let id = '';

  Object.defineProperty(
    el,
    'id',
    {
      get: () => id,
      set(v) {
        id = v;
        ids.set(v, this);
      },
    },
  );

  el.classList = {
    add(c) {
      el.className += ' ' + c;
    },
    remove(c) {
      el.className = el.className
        .split(/\s+/)
        .filter((x) => x !== c)
        .join(' ');
    },
    toggle(c, on) {
      const has = el.className.split(/\s+/).includes(c),
        next = on ?? !has;

      next ? this.add(c) : this.remove(c);

      return next;
    },
  };

  elements.push(el);

  return el;
}

function event(
  id,
  x,
  y,
  opts = {},
) {
  const [clientX, clientY] = point(
    id,
    x,
    y,
  );

  return {
    button: -1,
    clientX,
    clientY,
    isPrimary: false,
    pointerId: 10,
    pointerType: 'touch',
    preventDefault() {},
    ...activePointer,
    ...opts,
  };
}

function inventory() {
  for (const c of ['yellow', 'black']) {
    const expected = run(`physics.remainingBiscuits(discs,'${c}',running?null:color)`);

    for (const id of ['overview', 'target']) {
      const visible = elements.filter((e) => e.id.startsWith(id + 'Supply' + c) && !e.hidden);

      assert.equal(visible.length, expected);

      assert.equal(
        run(
          "discs.filter(d=>d.color==='" +
            `${c}` +
            "').length + (running?0:color==='" +
            `${c}` +
            "'&&physics.remainingBiscuits(discs,color)>0?1:0)",
        ) + expected,
        4,
      );

      for (const e of visible) {
        assert.equal(
          parseFloat(e.style['--disc-size']),
          run(`2*physics.R*viewMaps['${id}'].scale`),
        );
      }
    }
  }
}

function point(
  id,
  x,
  y,
) {
  return run(`viewMaps['${id}'].map(${x},${y})`);
}

function query(selector) {
  if (selector === '.info-button') {
    return [ids.get('accuracyHelp')];
  }

  if (selector === '.court-caption span') {
    return captions;
  }

  if (selector === '[data-tab]') {
    return elements.filter((e) => e.dataset.tab !== undefined);
  }

  if (selector === '[data-setup]') {
    return elements.filter((e) => e.dataset.setup);
  }

  if (selector === '.setup') {
    return elements.filter((e) => e.className.split(/\s+/).includes('setup'));
  }

  if (selector === '.biscuit-supply') {
    return elements.filter((e) => e.className.includes('biscuit-supply'));
  }

  return [];
}

function send(
  id,
  type,
  e,
) {
  for (const fn of ids.get(id).listeners[type] ?? []) {
    fn(e);
  }
}

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');

for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
  const attrs = m[2],
    id = attrs.match(/\bid="([^"]+)"/),
    cls = attrs.match(/\bclass="([^"]+)"/);

  if (!id && !cls && !attrs.includes('data-')) {
    continue;
  }

  const el = element(m[1]);

  if (id) {
    el.id = id[1];
  }

  if (cls) {
    el.className = cls[1];
  }

  el.checked = /\bchecked\b/.test(attrs);
  el.hidden = /\bhidden\b/.test(attrs);
  for (const attr of attrs.matchAll(/(aria-[a-z-]+)="([^"]+)"/g)) {
    el.setAttribute(attr[1], attr[2]);
  }

  el.value = attrs.match(/\bvalue="([^"]+)"/)?.[1] ?? '';
  for (const a of attrs.matchAll(/data-([a-z]+)="([^"]+)"/g)) {
    el.dataset[a[1]] = a[2];
  }

  el.parentElement = element('div');
}

const captions = [element('span'), element('span')];
const storage = new Map();

const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

const document = {
  addEventListener(k, fn) {
    (documentListeners[k] ??= []).push(fn);
  },
  body: element('body'),
  createElement: element,
  getElementById: (id) => ids.get(id),
  querySelectorAll: query,
};

const helpContainer = element('div');

helpContainer.append(ids.get('accuracyHelp'));
helpContainer.append(ids.get('accuracyNote'));

helpContainer.contains = (target) =>
  target === helpContainer || helpContainer.children.includes(target);

const context = vm.createContext({
  Math,
  Physics: require('../scripts/physics.js'),
  ResizeObserver: class {
    observe() {}
  },
  document,
  localStorage,
  requestAnimationFrame() {},
  structuredClone,
  window: {
    addEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 390,
  },
});

for (const file of [
  'state',
  'simulation',
  'view',
  'interactions',
  'tooltips',
  'app',
]) {
  vm.runInContext(fs.readFileSync(require.resolve('../scripts/' + file + '.js'), 'utf8'), context);
}

const run = (s) => vm.runInContext(s, context);

assert.equal(run("element('accuracy').value"), '95.0');
assert.equal(run("element('accuracy').value"), '95.0');
assert.equal(run("value('slick')"), 50);
assert.equal(run("value('drift')"), 0);
assert.equal(run('mobileView'), 'full');
assert.equal(run('shootingEnd'), 'head');
assert.equal(run('color'), 'yellow');
assert.equal(ids.get('fullView').getAttribute('aria-pressed'), 'true');

console.log(
  'PASS: requested accuracy, slickness, drift, full-court, Head, and Yellow startup defaults.',
);

let activePointer = {};

for (const end of ['head', 'foot']) {
  for (const pointer of [
    {
      button: 0,
      isPrimary: true,
      pointerType: 'touch',
    },
    {
      button: -1,
      isPrimary: false,
      pointerType: 'touch',
    },
    {
      button: 0,
      isPrimary: false,
      pointerType: 'mouse',
    },
  ]) {
    activePointer = pointer;
    run(`selectShootingEnd('${end}');setup('open')`);

    const blackStart = point(
        'overview',
        1.5,
        1.18,
      ),
      yellowStart = point(
        'overview',
        4.5,
        1.18,
      );

    assert.ok(
      yellowStart[1] > blackStart[1],
      'Full court keeps yellow below black at both shooting ends',
    );

    assert.ok(
      parseFloat(ids.get('overviewSupplyyellow').style.top) >
        parseFloat(ids.get('overviewSupplyblack').style.top),
      'Full-court supplies keep yellow below black',
    );

    const a = event(
      'target',
      4,
      34,
    );

    send(
      'target',
      'pointerdown',
      a,
    );

    assert.equal(run('aimPoint.x'), 4);
    assert.ok(Math.abs(run('aimPoint.y') - 34) < 1e-8, 'Emulated touch sets a target');
    const bank = ids.get('targetSupplyyellow');

    send(
      bank.id,
      'pointerdown',
      event(
        'target',
        7,
        26,
      ),
    );

    assert.equal(run('dragging.kind'), 'supply');

    send(
      bank.id,
      'pointermove',
      event(
        'target',
        4.5,
        35,
      ),
    );

    send(
      bank.id,
      'pointerup',
      event(
        'target',
        4.5,
        35,
      ),
    );

    assert.equal(
      run('discs.length'),
      1,
      'Touch drop places biscuit',
    );

    assert.equal(run('dragging'), null);

    send(
      'target',
      'pointerdown',
      event(
        'target',
        4.5,
        35,
      ),
    );

    assert.equal(run('dragging.kind'), 'disc');

    send(
      'target',
      'pointermove',
      event(
        'target',
        4,
        36,
        {
          pointerId: 11,
        },
      ),
    );

    assert.equal(
      run('discs[0].y'),
      35,
      'Second touch cannot take over',
    );

    send(
      'target',
      'pointermove',
      event(
        'target',
        4,
        36,
      ),
    );

    send(
      'target',
      'pointerup',
      event(
        'target',
        4,
        36,
      ),
    );

    assert.equal(run('discs[0].y'), 36);
    const p0 = JSON.stringify(run('aimPoint'));

    send(
      'target',
      'pointerdown',
      event(
        'target',
        2,
        32,
        {
          button: 2,
          isPrimary: true,
          pointerType: 'mouse',
        },
      ),
    );

    assert.equal(
      JSON.stringify(run('aimPoint')),
      p0,
      'Mouse right click is ignored',
    );

    const blackLeft = parseFloat(ids.get('targetSupplyblack').style.left),
      yellowLeft = parseFloat(ids.get('targetSupplyyellow').style.left);

    assert.ok(
      end === 'head' ? blackLeft < yellowLeft : yellowLeft < blackLeft,
      'Scoring-view supplies swap sides',
    );

    const initial = run('launch()');

    send(
      'overview',
      'pointerdown',
      event(
        'overview',
        initial.x,
        initial.y,
      ),
    );

    assert.equal(run('dragging.kind'), 'shooter');

    send(
      'overview',
      'pointermove',
      event(
        'overview',
        5,
        0.8,
      ),
    );

    send(
      'overview',
      'pointerup',
      event(
        'overview',
        5,
        0.8,
      ),
    );

    assert.ok(run("value('position')") > 50);
  }
}

console.log(
  'PASS: touch target placement, supply drops, biscuit/shooter drags, pointer ' +
    'ownership, secondary-click rejection, and Head/Foot supply sides.',
);

run(
  "selectShootingEnd('head');setup('open');discs=[createDisc(4.2,33,'yellow')]" +
    ';discs[0].vx=.3;discs[0].vy=.8;paths=[[[4.2,33],[4.4,34]]];selectShootingEn' +
    "d('foot');",
);

assert.equal(run('discs[0].x'), 4.2);
assert.equal(run('discs[0].y'), 6);
assert.equal(run('discs[0].vx'), 0.3);
assert.equal(run('discs[0].vy'), -0.8);
assert.equal(run('paths[0][0][0]'), 4.2);
assert.equal(run('paths[0][0][1]'), 6);

console.log(
  'PASS: full-court colors remain fixed; end changes preserve physical cross-c' +
    'ourt positions and velocities.',
);

const physics = require('../scripts/physics.js'),
  originalAccuracy = physics.applyAccuracy,
  originalAim = physics.sampleAim;

let accuracyCalls = 0,
  aimCalls = 0;

physics.applyAccuracy = (v, a) => {
  accuracyCalls++;

  return originalAccuracy(
    v,
    a,
    () => 0,
  );
};

physics.sampleAim = (
  angle,
  a,
  speed,
  distance,
  _random,
  options,
) => {
  aimCalls++;
  let i = 0;

  return originalAim(
    angle,
    a,
    speed,
    distance,
    () => [0.5, 0][i++],
    options,
  );
};

run(
  "setup('open');element('angle').value=2;element('speed').value=6;element('ac" +
    "curacy').value='90.0';element('accuracy').value='90.0';update();draw();",
);

assert.equal(
  accuracyCalls,
  0,
  'Preview redraws must not sample speed',
);

assert.equal(
  aimCalls,
  0,
  'Preview redraws must not sample aim',
);

run('fire()');

assert.equal(
  accuracyCalls,
  1,
  'Each fired shot samples speed once',
);

assert.equal(
  aimCalls,
  1,
  'Each fired shot samples aim once',
);

assert.ok(
  Math.abs(run('shotDisc.launchAngle') - (2 + 0.6 * Math.sqrt(-2 * Math.log(0.5)))) < 1e-10,
);

assert.ok(Math.abs(run('shotDisc.launchSpeed') - 5.4) < 1e-10);
assert.equal(run('shotDisc.x'), run('launch().x'));
assert.equal(run('shotDisc.y'), run('launch().y'));
run("finish();element('accuracy').value=0;element('accuracy').value=0;element('undo').onclick();");
assert.equal(run("element('accuracy').value"), '90.0');
assert.equal(run("element('accuracy').value"), '90.0');
run('fire(true)');

assert.equal(
  accuracyCalls,
  2,
  'Retry samples a fresh speed',
);

assert.equal(
  aimCalls,
  2,
  'Retry samples a fresh aim',
);

physics.applyAccuracy = originalAccuracy;
physics.sampleAim = originalAim;

console.log(
  'PASS: nominal predictions, one accuracy sample per setting at launch, uncha' +
    'nged starting position, accuracy Undo, and fresh Retry samples.',
);

run(
  "running=false;setup('open');element('accuracy').value='100.0';element('accu" +
    "racy').value='100.0';element('angle').value=0;element('speed').value=18;upd" +
    'ate();',
);

assert.ok(run("element('aimSpread').textContent").includes('50.0%'));
assert.ok(run('shot(true).aimSigma') > 0, 'Hard shots vary even at 100% base aim accuracy');
run("element('speed').value=8;update();");

assert.equal(
  run('shot(true).launchAngle'),
  0,
  '100% base accuracy remains exact at or below 8 ft/s',
);

console.log('PASS: displayed 18 ft/s miss calibration and slow-shot exactness.');
// Each rendered view mirrors the same inventory, with one normal-size alley disc per available biscuit.
run("running=false;setup('open')");
inventory();

run(
  "discs.push(createDisc(2,34,'black'));discs.push({...createDisc(-1,34,'yello" +
    "w'),out:true});update()",
);

inventory();
run("switchShooter('black')");
inventory();
run('fire()');
inventory();
run('finish()');
inventory();
const replayDepth = run('shotHistory.length');

run("element('undo').onclick()");
inventory();
assert.equal(ids.get('retry').disabled, false);
run("element('retry').onclick()");
inventory();

assert.equal(
  run('running'),
  true,
  'Replay fires immediately',
);

assert.equal(run('shotHistory.length'), replayDepth);
run('finish()');

console.log(
  'PASS: individual normal-size supply biscuits, eight-biscuit inventory inclu' +
    'ding queued/collected discs, and shot Replay with preserved four-biscuit inventory.',
);

// A wide scoring canvas rotates the diagram; pointer conversion must follow it.
ids.get('target').getBoundingClientRect = () => ({
  height: 250,
  left: 0,
  top: 0,
  width: 700,
});

for (const end of ['head', 'foot']) {
  run(`running=false;selectShootingEnd('${end}');setup('open');draw()`);
  assert.equal(run('viewMaps.target.vertical'), false);

  send(
    'target',
    'pointerdown',
    event(
      'target',
      4,
      34,
    ),
  );

  assert.ok(Math.abs(run('aimPoint.x') - 4) < 1e-8);
  assert.ok(Math.abs(run('aimPoint.y') - 34) < 1e-8);
  const bank = ids.get('targetSupplyblack');

  send(
    bank.id,
    'pointerdown',
    event(
      'target',
      -0.65,
      25.7,
    ),
  );

  send(
    bank.id,
    'pointermove',
    event(
      'target',
      2,
      35,
    ),
  );

  send(
    bank.id,
    'pointerup',
    event(
      'target',
      2,
      35,
    ),
  );

  assert.equal(run('discs.length'), 1);
  assert.ok(Math.abs(run('discs[0].x') - 2) < 1e-8);
  assert.ok(Math.abs(run('discs[0].y') - 35) < 1e-8);
}

console.log(
  'PASS: landscape scoring-view target placement and supply dragging at both shooting ends.',
);

// Undo ignores subsequent arrangement edits; Replay samples a new launch from the pre-shot state.
run("running=false;setup('open');element('accuracy').value='90.0';element('speed').value=6;");

run(
  "element('slick').value=65;element('drift').value=12;element('fastShotThreshold').value='9.5';",
);

const beforeShot = JSON.stringify(run('snapshot()'));
const savedApplyAccuracy = physics.applyAccuracy;
let launchSamples = 0;

physics.applyAccuracy = (speed, accuracy) =>
  savedApplyAccuracy(
    speed,
    accuracy,
    () => (++launchSamples % 2 ? 0.1 : 0.9),
  );

run('fire()');
const firstSpeed = run('shotDisc.launchSpeed');

run('finish();discs.push(createDisc(2,34));saveArrangement();');

assert.equal(
  run('shotHistory.length'),
  1,
  'Arrangement edits do not create shot history',
);

run("element('retry').onclick()");
assert.equal(run('running'), true);

assert.equal(
  run('shotHistory.length'),
  1,
  'Replay replaces the last shot history entry',
);

assert.notEqual(
  run('shotDisc.launchSpeed'),
  firstSpeed,
  'Replay samples fresh speed error',
);

assert.equal(
  run('discs.length'),
  1,
  'Replay removes arrangement edits made after the original shot',
);

run("finish();element('accuracy').value=0;element('slick').value=10;element('undo').onclick()");

assert.equal(
  JSON.stringify(run('snapshot()')),
  beforeShot,
  'Undo restores the complete pre-shot state',
);

assert.equal(run('lastShotUndone'), true);
run("element('retry').onclick()");

assert.equal(
  run('running'),
  true,
  'Replay also works immediately after Undo',
);

assert.equal(run('shotHistory.length'), 1);
assert.equal(launchSamples, 3);
physics.applyAccuracy = savedApplyAccuracy;
run('finish()');
console.log('PASS: shot-only Undo, full settings restoration, and fresh Replay before/after Undo.');

// Locking prevents selection and dragging while target clicks still reach the biscuit center.
run(
  "running=false;setup('open');discs=[createDisc(4,34,'black')];update();eleme" +
    "nt('biscuitLock').onclick()",
);

send(
  'target',
  'pointerdown',
  event(
    'target',
    4,
    34,
  ),
);

assert.equal(run('dragging'), null);
assert.ok(Math.abs(run('aimPoint.x') - 4) < 1e-8);
assert.equal(ids.get('targetSupplyyellow').disabled, true);
assert.equal(ids.get('biscuitLock').getAttribute('aria-pressed'), 'true');
run("element('biscuitLock').onclick()");

send(
  'target',
  'pointerdown',
  event(
    'target',
    4,
    34,
  ),
);

assert.equal(run('dragging.kind'), 'disc');

send(
  'target',
  'pointercancel',
  event(
    'target',
    4,
    34,
  ),
);

console.log('PASS: biscuit lock preserves target placement and prevents scoring-view drags.');
// Manual removal restores supply capacity; a canceled drag restores the original biscuit exactly.
for (const [x, y] of [
  [-0.1, 34],
  [6.1, 34],
  [4, -0.1],
  [4, 39.1],
]) {
  run("setup('open');discs=[createDisc(4,34,'black')];update()");
  const available = run("physics.remainingBiscuits(discs,'black',color)");

  send(
    'target',
    'pointerdown',
    event(
      'target',
      4,
      34,
    ),
  );

  send(
    'target',
    'pointermove',
    event(
      'target',
      x,
      y,
    ),
  );

  send(
    'target',
    'pointerup',
    event(
      'target',
      x,
      y,
    ),
  );

  assert.equal(run('discs.length'), 0);
  assert.equal(run("physics.remainingBiscuits(discs,'black',color)"), available + 1);
  inventory();
}

run("setup('open');discs=[createDisc(4,34,'black')];update()");
const originalDisc = JSON.stringify(run('discs[0]'));

send(
  'target',
  'pointerdown',
  event(
    'target',
    4,
    34,
  ),
);

send(
  'target',
  'pointermove',
  event(
    'target',
    -1,
    34,
  ),
);

send(
  'target',
  'pointercancel',
  event(
    'target',
    -1,
    34,
  ),
);

assert.equal(JSON.stringify(run('discs[0]')), originalDisc);
run('discs[0].out=true;update()');

assert.equal(
  run("physics.remainingBiscuits(discs,'black',color)"),
  3,
  'Shot-collected biscuits still consume inventory',
);

console.log(
  'PASS: removal on all four court edges, cancellation rollback, and retained ' +
    'dead-biscuit inventory.',
);

run("setup('open');element('accuracyDown').onclick()");
assert.equal(ids.get('accuracy').value, '89.9');
run("element('accuracyUp').onclick()");
assert.equal(ids.get('accuracy').value, '90.0');
run("element('accuracy').value=100;element('accuracyUp').onclick()");
assert.equal(ids.get('accuracy').value, '100.0');
run("element('accuracy').value=0;element('accuracyDown').onclick()");
assert.equal(ids.get('accuracy').value, '0.0');
run("element('fastShotThreshold').value='';");
assert.equal(run('fastShotOptions().threshold'), 8);
run("element('fastShotThreshold').value=12;element('fastShotInaccuracy').checked=false;update()");

assert.equal(
  run('shot(true).aimSigma') > 0,
  true,
  'Disabling fast-shot error does not disable ordinary accuracy error',
);

run("element('accuracy').value=100;element('speed').value=18;update()");
assert.equal(run('shot(true).aimSigma'), 0);
assert.equal(ids.get('fastShotThreshold').disabled, true);

console.log(
  'PASS: shared accuracy, 0.1 stepping and bounds, configurable fast-shot erro' +
    'r, and disabled threshold.',
);

run("element('slick').value=73;element('drift').value=-16;saveCourtSettings();");

run(
  "element('slick').value=1;element('drift').value=1;element('fastShotInaccura" +
    "cy').checked=true;loadCourtSettings();",
);

assert.equal(run("value('slick')"), 73);
assert.equal(run("value('drift')"), -16);
assert.equal(run('fastShotOptions().enabled'), false);
assert.equal(run('fastShotOptions().threshold'), 12);
run("setup('open')");

assert.equal(
  run("value('drift')"),
  -16,
  'Reset keeps persistent court settings',
);

run("localStorage.setItem('shotLab.court','invalid JSON');loadCourtSettings()");
assert.equal(run("value('slick')"), 73);
console.log('PASS: persistent court settings, reset preservation, and malformed-storage fallback.');
const help = ids.get('accuracyHelp');

help.onclick();
assert.equal(ids.get('accuracyNote').hidden, false);
for (const listener of documentListeners.pointerdown) {
  listener({ target: help });
}

assert.equal(ids.get('accuracyNote').hidden, false);
for (const listener of documentListeners.pointerdown) {
  listener({ target: document.body });
}

assert.equal(ids.get('accuracyNote').hidden, true);
assert.equal(help.getAttribute('aria-expanded'), 'false');

send(
  help.id,
  'focus',
  {},
);

assert.equal(ids.get('accuracyNote').hidden, false);
for (const listener of documentListeners.keydown) {
  listener({ key: 'Escape', target: help });
}

assert.equal(ids.get('accuracyNote').hidden, true);

send(
  help.id,
  'focus',
  {},
);

for (const listener of help.parentElement.listeners.pointerleave) {
  listener({});
}

assert.equal(ids.get('accuracyNote').hidden, true);
help.onclick();
for (const listener of documentListeners.pointerdown) {
  listener({ target: ids.get('accuracyNote') });
}

assert.equal(
  ids.get('accuracyNote').hidden,
  false,
  'Tooltip text remains hoverable and selectable',
);

run("element('aboutBtn').onclick()");

assert.equal(
  ids.get('accuracyNote').hidden,
  true,
  'Opening the dialog dismisses tooltips',
);

assert.equal(ids.get('about').open, true);
run("element('closeDialog').onclick()");
assert.equal(ids.get('about').open, false);

console.log(
  'PASS: tooltip touch toggle, outside dismissal, Escape/focus handling, and modal integration.',
);
