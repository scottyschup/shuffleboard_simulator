const { ESLint } = require('eslint');

const {
  orderCss,
  orderHtml,
  orderJs,
} = require('./source-order.cjs');

const fs = require('node:fs/promises');
const path = require('node:path');
const prettier = require('prettier');
const estree = require('prettier/plugins/estree');
const ts = require('typescript');
const babel = require('prettier/plugins/babel');
const typescript = require('prettier/plugins/typescript');
// Child expressions retain their own formatting when their parent's list is expanded.
const printedGroups = new WeakSet();

function breakOwnGroups(part) {
  if (!part || typeof part !== 'object' || printedGroups.has(part)) {
    return part;
  }

  if (Array.isArray(part)) {
    return part.map(breakOwnGroups);
  }

  if (part.type === 'fill') {
    return part.parts.map((item) =>
      item && item.type === 'line' ? prettier.doc.builders.hardline : breakOwnGroups(item),
    );
  }

  const result = { ...part };

  for (const key of [
    'breakContents',
    'contents',
    'expandedStates',
    'flatContents',
    'parts',
  ]) {
    if (key in result) {
      result[key] = breakOwnGroups(result[key]);
    }
  }

  if (part.type === 'group') {
    result.break = true;
  }

  return result;
}

async function formatFile(file) {
  let source = await fs.readFile(file, 'utf8');

  if (/\.(?:c?js|ts)$/.test(file)) {
    source = orderJs(source, file);
  } else if (file.endsWith('.css')) {
    source = orderCss(source);
  } else if (file.endsWith('.html')) {
    source = orderHtml(source);
  } else if (file.endsWith('.json')) {
    const sort = (value) =>
      Array.isArray(value)
        ? value.map(sort)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, sort(value[key])]),
            )
          : value;

    source = JSON.stringify(
      sort(JSON.parse(source)),
      null,
      2,
    );
  }

  if (/\.(?:c?js|ts)$/.test(file)) {
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
    );

    const edits = [];

    const splitStrings = (node) => {
      if (ts.isStringLiteral(node) && node.getText(tree).length > 95) {
        const chunks = node.text.match(/.{1,75}/gs);

        if (chunks.length > 1) {
          edits.push([
            node.getStart(tree),
            node.end,
            '(' + chunks.map(JSON.stringify).join(' +\n') + ')',
          ]);
        }
      }

      ts.forEachChild(node, splitStrings);
    };

    splitStrings(tree);
    for (const [
      start,
      end,
      text,
    ] of edits.sort((a, b) => b[0] - a[0])) {
      source = source.slice(0, start) + text + source.slice(end);
    }
  }

  source = await prettier.format(source, {
    filepath: file,
    ...(/\.(?:c?js|ts)$/.test(file)
      ? {
          parser: file.endsWith('.ts') ? 'lab-typescript' : 'lab-babel',
        }
      : {}),
    plugins: [ruleOfThrees],
    printWidth: 100,
    singleAttributePerLine: true,
    singleQuote: true,
  });

  if (/\.c?js$/.test(file)) {
    const [result] = await eslint.lintText(source, { filePath: path.resolve(file) });

    source = result.output || source;
  }

  if (file.endsWith('.html')) {
    source = source.replace(
      new RegExp(
        '(<\\/(?:div|section|aside|header|main|nav|dialog)>)(\\n[ \\t]*)(<(?:div|s' +
          'ection|aside|header|main|nav|dialog|script)\\b)',
        'g',
      ),
      '$1\n$2$3',
    );
  }

  await fs.writeFile(file, source);
}

async function main() {
  const files = [
    '.eslintrc.cjs',
    '.prettierrc.json',
    'index.html',
    'jsconfig.json',
    'package.json',
  ];

  for (const dir of [
    'scripts',
    'style',
    'tests',
  ]) {
    for (const name of await fs.readdir(dir)) {
      if (/\.(?:c?js|ts|css)$/.test(name)) {
        files.push(path.join(dir, name));
      }
    }
  }

  for (const file of files) {
    await formatFile(file);
  }
}

function rememberGroups(part) {
  if (!part || typeof part !== 'object' || printedGroups.has(part)) {
    return;
  }

  if (part.type === 'group' || part.type === 'fill') {
    printedGroups.add(part);
  }

  if (Array.isArray(part)) {
    part.forEach(rememberGroups);
  } else {
    for (const key of [
      'breakContents',
      'contents',
      'expandedStates',
      'flatContents',
      'parts',
    ]) {
      rememberGroups(part[key]);
    }
  }
}

const eslint = new ESLint({ fix: true });

const ruleOfThrees = {
  parsers: {
    'lab-babel': { ...babel.parsers.babel, astFormat: 'lab-estree' },
    'lab-typescript': { ...typescript.parsers.typescript, astFormat: 'lab-estree' },
  },
  printers: {
    'lab-estree': {
      ...estree.printers.estree,
      print(
        astPath,
        options,
        print,
        args,
      ) {
        let document = estree.printers.estree.print(
          astPath,
          options,
          print,
          args,
        );
        const node = astPath.node;
        const items = node.arguments || node.elements || node.properties || node.params;

        if (items && items.length >= 3) {
          document = breakOwnGroups(document);
        }

        rememberGroups(document);

        return document;
      },
    },
  },
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
