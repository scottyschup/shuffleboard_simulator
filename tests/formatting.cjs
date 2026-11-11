const assert = require('node:assert/strict');
const vm = require('node:vm');

const {
  orderCss,
  orderHtml,
  orderJs,
} = require('../scripts/source-order.cjs');

function evaluate(source) {
  return vm.runInNewContext(source);
}

const independentObject = 'Object.keys({ zebra: 3, alpha: 1, middle: 2 }).join(",")';

assert.equal(evaluate(orderJs(independentObject, 'sample.js')), 'alpha,middle,zebra');

const effects = `
const calls = [];
function record(value) { calls.push(value); return value; }
const result = { zebra: record('first'), alpha: record('second') };
JSON.stringify({ calls, result });
`;

assert.deepEqual(
  JSON.parse(evaluate(orderJs(effects, 'sample.js'))),
  JSON.parse(evaluate(effects)),
);

const spread = `JSON.stringify({ zebra: 0, ...{ alpha: 1 }, alpha: 2 })`;

assert.deepEqual(JSON.parse(evaluate(orderJs(spread, 'sample.js'))), JSON.parse(evaluate(spread)));

const hoisting = `
const result = zebra();
function zebra() { return alpha(); }
function alpha() { return 'kept'; }
result;
`;

assert.equal(evaluate(orderJs(hoisting, 'sample.js')), 'kept');

const comments = orderJs(
  `
function zebra() { try {} catch { /* Storage may be unavailable. */ } }
function alpha() { return true; }
`,
  'sample.js',
);

assert.ok(
  comments.includes('Storage may be unavailable.'),
  'Function ordering retains empty-catch explanations',
);

const fallback = orderCss('.example { z-index: 1; height: 100%; height: 100dvh; display: grid; }');

assert.ok(fallback.indexOf('display: grid') < fallback.indexOf('height: 100%'));
assert.ok(fallback.indexOf('height: 100%') < fallback.indexOf('height: 100dvh'));
assert.ok(fallback.indexOf('height: 100dvh') < fallback.indexOf('z-index: 1'));
const shorthand = orderCss('.example { margin-left: 4px; color: red; margin: 0; }');

assert.ok(
  shorthand.indexOf('margin-left: 4px') < shorthand.indexOf('margin: 0'),
  'Shorthand keeps its override',
);

const html = orderHtml('<script src="zebra.js"></script><script defer src="alpha.js"></script>');

assert.ok(
  html.indexOf('zebra.js') < html.indexOf('alpha.js'),
  'Alphabetizing attributes preserves script loading order',
);

assert.ok(html.includes('defer\nsrc="alpha.js"'));

console.log(
  'PASS: alphabetical formatting preserves evaluation order, spreads, hoisting' +
    ', comments, CSS fallbacks, and script order.',
);
