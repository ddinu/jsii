import ts = require('typescript');

export function stripCommentMarkers(comment: string, multiline: boolean) {
  if (multiline) {
    return comment
      .replace(/^\/(\*)+( )?/gm, '')
      .replace(/\*\/\s*$/gm, '')
      .replace(/^ \*( )?/gm, '');
  } else {
    return comment.replace(/^\/\/ /gm, '');
  }
}

export function stringFromLiteral(expr: ts.Expression) {
  if (ts.isStringLiteral(expr)) {
    return expr.text;
  }
  return '???';
}