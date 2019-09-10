import ts = require('typescript');
import { AstContext } from '../visitor';
import { stringFromLiteral } from "./ast-utils";

/**
 * Our own unification of import statements
 */
export interface ImportStatement {
  node: ts.Node;
  packageName: string;
  imports: FullImport | SelectiveImport;
}

export type FullImport =  { import: 'full', alias: string };
export type SelectiveImport =  { import: 'selective', elements: ImportBinding[] };

export interface ImportBinding {
  sourceName: string;
  alias?: string;
}

export function analyzeImportEquals(node: ts.ImportEqualsDeclaration, context: AstContext): ImportStatement {
  return {
    node,
    packageName: extractModuleName(node.moduleReference),
    imports: { import: 'full', alias: context.textOf(node.name) }
  };
}

export function analyzeImportDeclaration(node: ts.ImportDeclaration, context: AstContext): ImportStatement {
  const starImport = starImportName(node.importClause, context);
  if (starImport) {
    return {
      node,
      packageName: stringFromLiteral(node.moduleSpecifier),
      imports: { import: 'full', alias: starImport }
    };
  }

  const elements: ImportBinding[] = [];

  if (node.importClause && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
    elements.push(...node.importClause.namedBindings.elements.map(binding => (
      // regular import { name }, renamed import { propertyName, name }
      binding.propertyName ? {
        sourceName: context.textOf(binding.propertyName),
        alias: binding.name ? context.textOf(binding.name) : '???'
      } : {
        sourceName: binding.name ? context.textOf(binding.name) : '???'
      })));
  }

  return {
    node,
    packageName: stringFromLiteral(node.moduleSpecifier),
    imports: { import: 'selective', elements }
  };

}

/**
 * Extract the literal module name from a ModuleReference
 */
function extractModuleName(ref: ts.ModuleReference) {
  if (ts.isExternalModuleReference(ref)) {
    return stringFromLiteral(ref.expression);
  }

  return '???';
}

function starImportName(expr: ts.ImportClause | undefined, context: AstContext): string | undefined {
  if (!expr) { return undefined; }
  const bindings = expr.namedBindings;
  if (!bindings) { return undefined; }
  if (ts.isNamespaceImport(bindings)) {
    return context.textOf(bindings.name);

  }
  return undefined;
}