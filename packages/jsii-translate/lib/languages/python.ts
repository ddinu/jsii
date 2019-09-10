import ts = require('typescript');
import { OTree } from "../o-tree";
import { stripCommentMarkers } from '../typescript/ast-utils';
import { ImportStatement } from '../typescript/imports';
import { startsWithUppercase } from "../util";
import { AstContext, DefaultVisitor, nimpl } from "../visitor";

export class PythonVisitor extends DefaultVisitor {
  public commentRange(node: ts.CommentRange, context: AstContext): OTree {
    if (!node.hasTrailingNewLine) {
      throw new Error(`Cannot convert inline style comment to Python!`);
    }

    const commentText = stripCommentMarkers(context.textAt(node.pos, node.end), node.kind === ts.SyntaxKind.MultiLineCommentTrivia);

    return new OTree([...commentText.split('\n').map(l => `# ${l}\n`)]);
  }

  public importStatement(node: ImportStatement, context: AstContext): OTree {
    const moduleName = this.convertModuleReference(node.packageName);
    if (node.imports.import === 'full') {
      return new OTree([`import ${moduleName} as ${mangleIdentifier(node.imports.alias)}`], [], {
        newline: true,
      });
    }
    if (node.imports.import === 'selective') {
      const imports = node.imports.elements.map(im =>
          im.alias
          ? `${mangleIdentifier(im.sourceName)} as ${mangleIdentifier(im.alias)}`
          : mangleIdentifier(im.sourceName));

      return new OTree([`from ${moduleName} import ${imports.join(', ')}`], [], {
        newline: true,
      });
    }

    return nimpl(node.node, context);
  }

  public token<A extends ts.SyntaxKind>(node: ts.Token<A>, context: AstContext): OTree {
    const text = context.textOf(node);
    if (text === 'this') { return new OTree(['self']); }
    return super.token(node, context);
  }

  public identifier(node: ts.Identifier, _context: AstContext) {
    const originalIdentifier = node.text;
    return new OTree([mangleIdentifier(originalIdentifier)]);
  }

  public functionDeclaration(node: ts.FunctionDeclaration, context: AstContext): OTree {
    return new OTree([
      'def ',
      context.convert(node.name),
      '(',
      new OTree([], context.convertAll(node.parameters), {
        separator: ', ',
      }),
      ')',
    ], [context.convert(node.body)], {
      suffix: '\n\n'
    });
  }

  public block(node: ts.Block, context: AstContext): OTree {
    const children = node.statements.length > 0
        ? context.convertAll(node.statements)
        : [new OTree(['pass'])];

    return new OTree([], children, {
      newline: true,
      indent: 4,
      separator: '\n',
    });
  }

  public callExpression(node: ts.CallExpression, context: AstContext): OTree {
    return new OTree([
      context.convert(node.expression),
      '(',
      convertFunctionCallArguments(node.arguments, context),
      ')']);
  }

  public propertyAccessExpression(node: ts.PropertyAccessExpression, context: AstContext) {
    const fullText = context.textOf(node);
    if (fullText in BUILTIN_FUNCTIONS) {
      return new OTree([BUILTIN_FUNCTIONS[fullText]]);
    }
    return super.propertyAccessExpression(node, context);
  }

  public parameterDeclaration(node: ts.ParameterDeclaration, context: AstContext): OTree {
    return new OTree([context.convert(node.name)]);
  }

  public ifStatement(node: ts.IfStatement, context: AstContext): OTree {
    const ifStmt = new OTree(
      ['if ', context.convert(node.expression), ': '],
      [context.convert(node.thenStatement)]);
    const elseStmt = node.elseStatement ? new OTree([`else: `], [context.convert(node.elseStatement)]) : undefined;

    return elseStmt ? new OTree([], [ifStmt, elseStmt], {
      separator: '\n',
    }) : ifStmt;
  }

  public objectLiteralExpression(node: ts.ObjectLiteralExpression, context: AstContext): OTree {
    return new OTree(['{'],
      context.convertAll(node.properties),
      {
        newline: true,
        separator: ',\n',
        indent: 4,
        suffix: '\n}',
      },
    );
  }

  public propertyAssignment(node: ts.PropertyAssignment, context: AstContext): OTree {
    return new OTree([
      '"',
      context.convert(node.name),
      '": ',
      context.convert(node.initializer)
    ]);
  }

  public newExpression(node: ts.NewExpression, context: AstContext): OTree {
    return new OTree([
      context.convert(node.expression),
      '(',
      convertFunctionCallArguments(node.arguments, context),
      ')'
    ]);
  }

  public variableDeclaration(node: ts.VariableDeclaration, context: AstContext): OTree {
    return new OTree([
      mangleIdentifier(context.textOf(node.name)),
      ' = ',
      context.convert(node.initializer)
    ]);
  }

  public thisKeyword() {
    return new OTree(['self']);
  }

  public shorthandPropertyAssignment(node: ts.ShorthandPropertyAssignment, context: AstContext): OTree {
    return new OTree([
      '"',
      context.convert(node.name),
      '": ',
      context.convert(node.name)
    ]);
  }

  protected convertModuleReference(ref: string) {
    return ref.replace(/^@/, '').replace(/\//g, '.').replace(/-/g, '_');
  }
}

export function mangleIdentifier(originalIdentifier: string) {
  if (startsWithUppercase(originalIdentifier)) {
    // Probably a class, leave as-is
    return originalIdentifier;
  } else {
    // Turn into snake-case
    return originalIdentifier.replace(/[^A-Z][A-Z]/g, m => m[0].substr(0, 1) + '_' + m.substr(1).toLowerCase());
  }
}

/**
 * Convert arguments.
 *
 * In effect, if the last one is an object literal, explode it.
 */
function convertFunctionCallArguments(args: ts.NodeArray<ts.Expression> | undefined, context: AstContext) {
  if (!args) { return new OTree([]); }
  const converted = context.convertAll(args);

  if (args.length > 0) {
    const lastArg = args[args.length - 1];
    if (ts.isObjectLiteralExpression(lastArg)) {
      converted.pop();

      converted.push(...lastArg.properties.map(convertProp));
    }
  }

  return new OTree([], converted, { separator: ', ' });

  function convertProp(prop: ts.ObjectLiteralElementLike) {
    if (ts.isPropertyAssignment(prop)) {
      return new OTree([mangleIdentifier(context.textOf(prop.name)), '=', context.convert(prop.initializer)]);
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      return new OTree([mangleIdentifier(context.textOf(prop.name)), '=', mangleIdentifier(context.textOf(prop.name))]);
    } else {
      return new OTree(['???']);
    }
  }
}

const BUILTIN_FUNCTIONS: {[key: string]: string} = {
  'console.log': 'print',
  'console.error': 'sys.stderr.write',
  'Math.random': 'random.random'
};