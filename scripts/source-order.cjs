const ts = require('typescript');

function alphabetical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cssFamily(property) {
  if (
    /^(margin|padding|background|border|outline|font|grid|animation|transition)(-|$)/.test(property)
  ) {
    return property.split('-')[0];
  }

  if (property === 'line-height') {
    return 'font';
  }

  if (/^overflow(-|$)/.test(property)) {
    return 'overflow';
  }

  if (/^flex(-basis|-grow|-shrink)?$/.test(property)) {
    return 'flex';
  }

  return property;
}

function effectful(node) {
  if (!node || ts.isFunctionLike(node)) {
    return false;
  }

  if (ts.isCallExpression(node)) {
    const pure = new Set([
      'accuracy',
      'aimDistance',
      'courtDeceleration',
      'courtSettings',
      'element',
      'fastShotOptions',
      'input',
      'launch',
      'Number',
      'String',
      'structuredClone',
      'value',
    ]);

    const callee = node.expression;

    const math =
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'Math' &&
      callee.name.text !== 'random';

    if (!(ts.isIdentifier(callee) && pure.has(callee.text)) && !math) {
      return true;
    }
  }

  if (
    ts.isNewExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isYieldExpression(node) ||
    ts.isDeleteExpression(node) ||
    ts.isPostfixUnaryExpression(node)
  ) {
    return true;
  }

  if (
    ts.isPrefixUnaryExpression(node) &&
    [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
  ) {
    return true;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return true;
  }

  return Boolean(ts.forEachChild(node, (child) => effectful(child) || undefined));
}

function orderCss(source) {
  let result = '';
  let start = 0;
  let quote = null;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if ('"\''.includes(character)) {
      quote = character;
      continue;
    }

    if (character !== '{') {
      continue;
    }

    const opening = index;
    let depth = 1;

    while (++index < source.length && depth) {
      const char = source[index];

      if (quote) {
        if (char === '\\') {
          index++;
        } else if (char === quote) {
          quote = null;
        }
      } else if ('"\''.includes(char)) {
        quote = char;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      }
    }

    // The loop advances one character beyond the closing brace.
    const closing = index - 1;
    const body = source.slice(opening + 1, closing);

    result += source.slice(start, opening + 1);
    if (body.includes('{')) {
      result += orderCss(body);
    } else {
      const declarations = splitTopLevel(body, ';')
        .map((text) => text.trim())
        .filter(Boolean);

      const property = (declaration) => declaration.slice(0, declaration.indexOf(':')).trim();

      const sorted = ordered(
        declarations,
        property,
        (item) =>
          declarations
            .slice(0, declarations.indexOf(item))
            .filter((other) => cssFamily(property(other)) === cssFamily(property(item))),
      );

      result += '\n' + sorted.join(';\n') + ';\n';
    }

    result += '}';
    start = index;
    index--;
  }

  return result + source.slice(start);
}

function orderHtml(source) {
  return source.replace(
    /<([a-z][\w-]*)(\s+(?:[^>"']|"[^"]*"|'[^']*')*)?(\/?)>/gi,
    (
      match,
      tag,
      attributes,
      closing,
    ) => {
      if (!attributes) {
        return match;
      }

      const items = attributes.match(/[^\s="'<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g);

      if (!items) {
        return match;
      }

      items.sort((left, right) =>
        alphabetical(left.split('=')[0].trim(), right.split('=')[0].trim()),
      );

      return '<' + tag + '\n' + items.join('\n') + (closing ? '/>' : '>');
    },
  );
}

function orderJs(source, file) {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  const transformed = ts.transform(tree, [
    (context) => {
      function orderStatements(statements) {
        const original = statements;
        const grouped = [];
        let arrows = [];

        const flushArrows = () => {
          if (arrows.length) {
            for (const declaration of ordered(arrows, (node) => node.name.text)) {
              grouped.push(
                ts.factory.createVariableStatement(
                  undefined,
                  ts.factory.createVariableDeclarationList([declaration], ts.NodeFlags.Const),
                ),
              );
            }
          }

          arrows = [];
        };

        for (const statement of statements) {
          if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.flags & ts.NodeFlags.Const &&
            statement.declarationList.declarations.every(
              (node) =>
                ts.isIdentifier(node.name) &&
                node.initializer &&
                (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)),
            )
          ) {
            arrows.push(...statement.declarationList.declarations);
          } else {
            flushArrows();
            grouped.push(statement);
          }
        }

        flushArrows();
        statements = grouped;
        const functions = statements.filter((statement) => ts.isFunctionDeclaration(statement));

        if (functions.length < 2) {
          return statements.length === original.length &&
            statements.every((item, index) => item === original[index])
            ? original
            : statements;
        }

        const sorted = [...functions].sort((left, right) =>
          alphabetical(left.name.text, right.name.text),
        );

        const result = [];
        let inserted = false;

        for (const statement of statements) {
          if (ts.isFunctionDeclaration(statement)) {
            if (!inserted) {
              result.push(...sorted);
            }

            inserted = true;
          } else {
            result.push(statement);
          }
        }

        return result;
      }

      function visit(node) {
        node = ts.visitEachChild(
          node,
          visit,
          context,
        );

        if (ts.isObjectLiteralExpression(node)) {
          const result = [];
          let segment = [];

          const flush = () => {
            // Spreads and computed keys are barriers; effectful initializers retain relative order.
            const effects = segment.filter((property) => effectful(property.initializer));

            result.push(
              ...ordered(
                segment,
                propertyName,
                (item) => {
                  const previous = segment.slice(0, segment.indexOf(item));

                  return previous.filter(
                    (other) =>
                      propertyName(other) === propertyName(item) ||
                      (effects.includes(item) && effects.includes(other)),
                  );
                },
              ),
            );

            segment = [];
          };

          for (const property of node.properties) {
            if (propertyName(property) === null) {
              flush();
              result.push(property);
            } else {
              segment.push(property);
            }
          }

          flush();

          return ts.factory.updateObjectLiteralExpression(node, result);
        }

        if (ts.isInterfaceDeclaration(node)) {
          const indexes = node.members.filter((member) => ts.isIndexSignatureDeclaration(member));
          const members = node.members.filter((member) => !ts.isIndexSignatureDeclaration(member));

          if (members.every((member) => propertyName(member) !== null)) {
            return ts.factory.updateInterfaceDeclaration(
              node,
              node.modifiers,
              node.name,
              node.typeParameters,
              node.heritageClauses,
              [...indexes, ...ordered(members, propertyName)],
            );
          }
        }

        if (ts.isBlock(node)) {
          return ts.factory.updateBlock(node, orderStatements(node.statements));
        }

        if (ts.isSourceFile(node)) {
          return ts.factory.updateSourceFile(node, orderStatements(node.statements));
        }

        return node;
      }

      return visit;
    },
  ]);

  const result = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(transformed.transformed[0]);

  transformed.dispose();

  return result.replace(
    /\/\* exported\s+([^*]+)\*\//g,
    (_match, names) =>
      '/* exported\n' +
      names
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .sort()
        .map((name) => '  ' + name)
        .join(',\n') +
      '\n*/',
  );
}

function ordered(
  items,
  name,
  dependencies = () => [],
) {
  const pending = [...items];
  const result = [];

  while (pending.length) {
    const candidates = pending.filter(
      (item) => !dependencies(item).some((other) => pending.includes(other)),
    );

    candidates.sort((left, right) => alphabetical(name(left), name(right)));
    const next = candidates[0] || pending[0];

    result.push(next);
    pending.splice(pending.indexOf(next), 1);
  }

  return result;
}

function propertyName(node) {
  return node.name && !ts.isComputedPropertyName(node.name) ? node.name.text : null;
}

function splitTopLevel(source, delimiter) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;

  for (let index = 0; index < source.length; index++) {
    const character = source[index];

    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = null;
      }
    } else if ('"\''.includes(character)) {
      quote = character;
    } else if ('([{'.includes(character)) {
      depth++;
    } else if (')]}'.includes(character)) {
      depth--;
    } else if (!depth && character === delimiter) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));

  return parts;
}

module.exports = {
  orderCss,
  orderHtml,
  orderJs,
};
