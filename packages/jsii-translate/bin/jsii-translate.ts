import fs = require("fs");
import yargs = require('yargs');
import { FileSource, isErrorDiagnostic, LiteralSource, printDiagnostics,
  renderTree, translateMarkdown, translateTypeScript } from '../lib';
import { PythonVisitor } from '../lib/languages/python';
import { VisualizeAstVisitor } from '../lib/visitor';

async function main() {
  const argv = yargs
    .usage('$0 [file]')
    .option('python', { alias: 'p' })
    .option('markdown', { alias: 'm' })
    .help()
    .version(require('../package.json').version)
    .argv;

  let visitor;
  if (argv.python) { visitor = new PythonVisitor(); }
  if (!visitor) { visitor = new VisualizeAstVisitor(); }

  const fakeInputFileName = argv.markdown ? 'stdin.md' : 'stdin.ts';

  const source = argv._.length > 0
      ? new FileSource(argv._[0])
      : new LiteralSource(fs.readFileSync(0, "utf-8"), fakeInputFileName);

  const result = argv.markdown
      ? translateMarkdown(source, visitor)
      : translateTypeScript(source, visitor);

  process.stdout.write(renderTree(result.tree));

  if (result.diagnostics.length > 0) {
    printDiagnostics(result.diagnostics, process.stderr);

    if (result.diagnostics.some(isErrorDiagnostic)) {
      process.exit(1);
    }
  }
}

main().catch(e => {
  // tslint:disable-next-line:no-console
  console.error(e);
  process.exit(1);
});