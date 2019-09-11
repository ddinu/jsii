export interface OTreeOptions {
  /**
   * Add a newline at the end of the prefix.
   *
   * Newline is subject to new indentation.
   */
  newline?: boolean;

  /**
   * Adjust indentation with the given number
   */
  indent?: number;

  /**
   * Separate children with the given string
   */
  separator?: string;

  /**
   * Suffix the token after outdenting
   */
  suffix?: string;
}

export class OTree {
  private readonly prefix: Array<OTree | string>;
  private readonly children: Array<OTree | string>;

  constructor(
    prefix: Array<OTree | string | undefined>,
    children?: Array<OTree | string | undefined>,
    private readonly options: OTreeOptions = {}) {

    this.prefix = prefix.filter(notUndefined).filter(notEmpty);
    this.children = (children || []).filter(notUndefined).filter(notEmpty);
  }

  public write(sink: OTreeSink) {
    const indent = this.options.indent || 0;

    for (const x of this.prefix) {
      sink.write(x);
    }

    sink.adjustIndent(indent);
    if (this.options.newline) { sink.newline(); }

    let first = true;
    for (const child of this.children || []) {
      if (!first && this.options.separator) { sink.write(this.options.separator); }
      first = false;

      sink.write(child);
    }

    sink.adjustIndent(-indent);

    if (this.options.suffix) {
      sink.write(this.options.suffix);
    }
  }

  public get isEmpty() {
    return this.prefix.length + this.children.length === 0;
  }

  public toString() {
    return `<INCORRECTLY STRINGIFIED ${this.prefix}>`;
  }
}

export const EMPTY_NODE = new OTree([]);

export class UnknownSyntax extends OTree {
}

export class OTreeSink {
  private indent = 0;
  private readonly fragments = new Array<string>();

  public write(text: string | OTree) {
    if (text instanceof OTree) {
      text.write(this);
    } else {
      this.append(text.replace(/\n/g, '\n' + ' '.repeat(this.indent)));
    }
  }

  public newline() {
    this.write('\n');
  }

  public adjustIndent(x: number) {
    this.indent += x;
  }

  public toString() {
    // Strip trailing whitespace from every line
    return this.fragments.join('').replace(/[ \t]+$/gm, '');
  }

  private append(x: string) {
    this.fragments.push(x);
  }
}

function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

function notEmpty(x: OTree | string) {
  return x instanceof OTree ? !x.isEmpty : x !== '';
}