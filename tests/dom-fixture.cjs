const fs = require('node:fs');
const vm = require('node:vm');

function createFixture() {
  const elements = [];
  const ids = new Map();
  const storage = new Map();
  let document;

  function createElement(tag = 'div') {
    let id = '';
    let value = '';

    const element = {
      addEventListener(type, handler) {
        (this.listeners[type] ||= []).push(handler);
      },
      append(...children) {
        for (const child of children) {
          if (child.parentElement) {
            child.parentElement.children = child.parentElement.children.filter(
              (item) => item !== child,
            );
          }

          child.parentElement = this;
          this.children.push(child);
        }
      },
      attributes: {},
      before(child) {
        child.parentElement = this.parentElement;

        this.parentElement.children.splice(
          this.parentElement.children.indexOf(this),
          0,
          child,
        );
      },
      checked: false,
      children: [],
      className: '',
      close() {
        this.open = false;
        dispatch(this, 'close');
      },
      contains(target) {
        return target === this || this.children.some((child) => child.contains(target));
      },
      dataset: {},
      disabled: false,
      focus() {
        const previous = document.activeElement;

        document.activeElement = this;
        if (previous?.parentElement) {
          dispatch(
            previous.parentElement,
            'focusout',
            { relatedTarget: this },
          );
        }

        dispatch(this, 'focus');
      },
      getAttribute(key) {
        return this.attributes[key] ?? null;
      },
      getBoundingClientRect() {
        const defaults = {
          overview: {
            height: 930,
            left: 580,
            top: 0,
            width: 100,
          },
          shooting: {
            height: 280,
            left: 0,
            top: 650,
            width: 500,
          },
          target: {
            height: 600,
            left: 0,
            top: 0,
            width: 500,
          },
        };

        const rect = this.rect ||
          defaults[this.id] || {
            height: 36,
            left: 530,
            top: 35,
            width: 36,
          };

        return {
          ...rect,
          bottom: rect.top + rect.height,
          right: rect.left + rect.width,
        };
      },
      getContext() {
        return new Proxy({}, { get: () => () => {} });
      },
      hidden: false,
      listeners: {},
      open: false,
      parentElement: null,
      setAttribute(key, item) {
        this.attributes[key] = String(item);
      },
      setPointerCapture() {},
      showModal() {
        this.open = true;
        elements.find((child) => this.contains(child) && child.autofocus)?.focus();
      },
      style: {
        setProperty(key, item) {
          this[key] = item;
        },
      },
      tagName: tag.toUpperCase(),
    };

    Object.defineProperty(
      element,
      'id',
      {
        get: () => id,
        set(next) {
          id = next;
          ids.set(next, this);
        },
      },
    );

    Object.defineProperty(
      element,
      'value',
      {
        get: () => value,
        set(next) {
          value = String(next);
        },
      },
    );

    element.classList = {
      add(name) {
        if (!this.contains(name)) {
          element.className = (element.className + ' ' + name).trim();
        }
      },
      contains(name) {
        return element.className.split(/\s+/).includes(name);
      },
      remove(name) {
        element.className = element.className
          .split(/\s+/)
          .filter((item) => item !== name)
          .join(' ');
      },
      toggle(name, next = !this.contains(name)) {
        next ? this.add(name) : this.remove(name);

        return next;
      },
    };

    elements.push(element);

    return element;
  }

  function dispatch(
    element,
    type,
    event = {},
  ) {
    const supplied = {
      button: 0,
      clientX: 0,
      clientY: 0,
      key: '',
      pointerId: 1,
      pointerType: 'mouse',
      preventDefault() {},
      target: element,
      ...event,
    };

    if (type === 'click' && element.disabled) {
      return;
    }

    for (const handler of element.listeners[type] || []) {
      handler(supplied);
    }

    if (type === 'click') {
      element.onclick?.(supplied);
    }
  }

  function matches(element, selector) {
    const parts = selector.trim().split(/\s+/);
    const last = parts.pop();

    const simple = (candidate) => {
      const id = last.match(/#([\w-]+)/)?.[1];
      const cls = last.match(/\.([\w-]+)/)?.[1];
      const attr = last.match(/\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/);
      const tag = last.match(/^[a-z]+/i)?.[0];

      return (
        (!id || candidate.id === id) &&
        (!cls || candidate.classList.contains(cls)) &&
        (!tag || candidate.tagName === tag.toUpperCase()) &&
        (!attr || candidate.attributes[attr[1]] !== undefined)
      );
    };

    if (!simple(element)) {
      return false;
    }

    if (!parts.length) {
      return true;
    }

    let parent = element.parentElement;

    while (parent) {
      if (matches(parent, parts.join(' '))) {
        return true;
      }

      parent = parent.parentElement;
    }

    return false;
  }

  const body = createElement('body');

  document = {
    activeElement: null,
    addEventListener(type, handler) {
      (this.listeners[type] ||= []).push(handler);
    },
    body,
    createElement,
    getElementById: (id) => ids.get(id) || null,
    listeners: {},
    querySelectorAll: (selector) =>
      elements.filter((element) => selector.split(',').some((part) => matches(element, part))),
  };

  const stack = [body];
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');

  for (const match of html.matchAll(/<(\/?)([\w-]+)\b([^>]*)>/g)) {
    const [
      ,
      closing,
      tag,
      attrs,
    ] = match;

    if (closing) {
      if (stack.length > 1) {
        stack.pop();
      }

      continue;
    }

    const element = createElement(tag);

    for (const attribute of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
      const [
        ,
        key,
        item = '',
      ] = attribute;

      element.setAttribute(key, item);
      if (key === 'id') {
        element.id = item;
      }

      if (key === 'class') {
        element.className = item;
      }

      if (key === 'value') {
        element.value = item;
      }

      if (key.startsWith('data-')) {
        element.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] =
          item;
      }

      if (
        [
          'autofocus',
          'checked',
          'disabled',
          'hidden',
        ].includes(key)
      ) {
        element[key] = true;
      }
    }

    stack[stack.length - 1].append(element);
    if (
      ![
        'input',
        'img',
        'link',
        'meta',
        'br',
        'hr',
      ].includes(tag)
    ) {
      stack.push(element);
    }
  }

  const context = vm.createContext({
    Math,
    Physics: require('../scripts/physics.js'),
    ResizeObserver: class {
      observe() {}
    },
    document,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, item) => storage.set(key, item),
    },
    requestAnimationFrame() {},
    structuredClone,
    window: { devicePixelRatio: 1, innerWidth: 1000 },
  });

  for (const file of [
    'state',
    'simulation',
    'view',
    'interactions',
    'supply',
    'app',
  ]) {
    vm.runInContext(
      fs.readFileSync(require.resolve('../scripts/' + file + '.js'), 'utf8'),
      context,
    );
  }

  const click = (id) => {
    ids.get(id).focus();
    dispatch(ids.get(id), 'click');
  };

  const pointEvent = (
    id,
    x,
    y,
    extra = {},
  ) => {
    const [screenX, screenY] = run(`viewMaps.${id}.map(${x}, ${y})`);
    const rect = ids.get(id).getBoundingClientRect();

    return {
      clientX: screenX + rect.left,
      clientY: screenY + rect.top,
      ...extra,
    };
  };

  const run = (code) => vm.runInContext(code, context);

  return {
    click,
    context,
    dispatch,
    document,
    ids,
    pointEvent,
    run,
  };
}

module.exports = { createFixture };
