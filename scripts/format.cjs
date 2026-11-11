const fs = require('node:fs/promises');
const path = require('node:path');
const prettier = require('prettier');
const estree = require('prettier/plugins/estree');
const ts = require('typescript');
const babel = require('prettier/plugins/babel');
const typescript = require('prettier/plugins/typescript');

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
        const document =
          estree.printers.estree.print(
            astPath,
            options,
            print,
            args,
          );
        const node =
          astPath.node;
        const items =
          node.arguments ||
          node.elements ||
          node.properties ||
          node.params;
        if (
          !items ||
          items.length <
            3
        ) {
          return document;
        }
        return prettier.doc.utils.mapDoc(
          document,
          (
            part,
          ) =>
            part &&
            part.type ===
              'group'
              ? {
                  ...part,
                  break: true,
                }
              : part,
        );
      },
    },
  },
};

async function formatFile(file) {
  let source = await fs.readFile(file, 'utf8');
  if (/\.(?:c?js|ts)$/.test(file)) {
    const tree = ts.createSourceFile(
      file,
      source,
      ts
        .ScriptTarget
        .Latest,
      true,
    );
    const edits = [];
    const splitStrings = (node) => {
      if (ts.isStringLiteral(node) && node.getText(tree).length > 95) {
        const chunks = node.text.match(/.{1,75}/gs);
        if (chunks.length > 1) {
          edits.push([
            node.getStart(
              tree,
            ),
            node.end,
            '(' +
              chunks
                .map(
                  JSON.stringify,
                )
                .join(
                  ' +\n',
                ) +
              ')',
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
    filepath:
      file,
    ...(/\.(?:c?js|ts)$/.test(
      file,
    )
      ? {
          parser:
            file.endsWith(
              '.ts',
            )
              ? 'lab-typescript'
              : 'lab-babel',
        }
      : {}),
    printWidth: 100,
    singleQuote: true,
    singleAttributePerLine: true,
    plugins:
      [
        ruleOfThrees,
      ],
  });
  await fs.writeFile(file, source);
}

async function main() {
  const files = [
    'index.html',
    'package.json',
    'jsconfig.json',
    '.eslintrc.cjs',
  ];
  for (const dir of [
    'scripts',
    'tests',
    'style',
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
