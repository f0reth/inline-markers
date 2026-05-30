import { TagConfig } from "./types";

// Pure, vscode-independent comment scanner. It compiles a user tag list into a small set
// of regexes (once per settings change) and scans raw text in a single pass per layer
// (single-line comments + optional block comments), returning offset-derived positions.

export interface Position {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface ScanMatch {
  tagIndex: number; // index into the source tags array
  message: string;
  range: Position; // decoration range (delimiter→EOL for single-line, tag→EOL for block lines)
  tagRange: Position; // the tag token itself
}

export interface Matcher {
  tags: TagConfig[];
  isWord: boolean[]; // per tag: true for word tags (TODO), false for symbol tags (!, ?, *)
  singleLine: RegExp;
  block: RegExp;
  blockInner: RegExp;
}

// strips trailing block-comment closers (*/, -->) from a single-line message
const TRAIL_RE = /(?:\s*\*+\/|\s*-->)\s*$/;

// a tag is a "word" tag when it begins with an alphanumeric character (e.g. TODO),
// as opposed to a "symbol" tag (e.g. !, ?, *)
const WORD_TAG_RE = /^[A-Za-z0-9]/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isWordTag(tag: string): boolean {
  return WORD_TAG_RE.test(tag);
}

// builds one alternation branch for the single-line matcher. Each branch contains exactly
// one capture group (the tag token), so branch index maps cleanly to tag index.
function singleLineBranch(tag: string): string {
  const esc = escapeRegExp(tag);
  if (isWordTag(tag)) return `(${esc}\\b[:-]?)`;
  // symbol tag: "!" may also sit at end-of-line (before a newline); others require space/tab/eol
  const eol = tag === "!" ? "[ \\t\\n]" : "[ \\t]";
  return `(${esc})(?=${eol}|$)`;
}

function blockInnerBranch(tag: string): string {
  const esc = escapeRegExp(tag);
  if (isWordTag(tag)) return `(${esc}\\b[:-]?)`;
  return `(${esc})(?=\\s|$)`;
}

export function compileMatcher(tags: TagConfig[]): Matcher {
  const isWord = tags.map((t) => isWordTag(t.tag));
  const singleBranches = tags.map((t) => singleLineBranch(t.tag)).join("|");
  const innerBranches = tags.map((t) => blockInnerBranch(t.tag)).join("|");

  // no ^ anchor — also matches inline comments (e.g. `const x = 1; // TODO: fix`)
  const singleLine = new RegExp(
    `(?:\\/\\/|#|--|<!--|\\/\\*+)[ \\t*!?]*[ \\t]*(?:${singleBranches})[ \\t]*(.*)`,
    "ig",
  );
  const blockInner = new RegExp(`^[ \\t]*\\*?[ \\t]*(?:${innerBranches})\\s*(.*)`, "gim");
  // outer block frame for /* */ and /** */ (g2 captures the opening delimiter)
  const block = /(^|[ \t])(\/\*\*?)([\s\S]*?)(\*\/)/gm;

  return { tags, isWord, singleLine, block, blockInner };
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  let idx = text.indexOf("\n");
  while (idx !== -1) {
    starts.push(idx + 1);
    idx = text.indexOf("\n", idx + 1);
  }
  return starts;
}

// maps an absolute offset to a {line, character} via binary search over line-start offsets.
// Equivalent to vscode TextDocument.positionAt for \n / \r\n line endings.
function positionAt(lineStarts: number[], offset: number): { line: number; character: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, character: offset - lineStarts[lo] };
}

// finds which alternation branch matched: exactly one of groups 1..tagCount is defined.
function pickTag(m: RegExpExecArray, tagCount: number): { tagIndex: number; tagText: string } {
  for (let i = 1; i <= tagCount; i++) {
    if (m[i] !== undefined) return { tagIndex: i - 1, tagText: m[i] };
  }
  return { tagIndex: -1, tagText: "" };
}

function span(lineStarts: number[], from: number, to: number): Position {
  const a = positionAt(lineStarts, from);
  const b = positionAt(lineStarts, to);
  return {
    startLine: a.line,
    startCharacter: a.character,
    endLine: b.line,
    endCharacter: b.character,
  };
}

export function scanText(text: string, matcher: Matcher, multiline: boolean): ScanMatch[] {
  const results: ScanMatch[] = [];
  // single Set deduplicates between the single-line pass and the block pass, so a tag written
  // on a block's opening line (e.g. `/* TODO: foo` ... `*/`) is reported once, not twice.
  const used = new Set<number>();
  const lineStarts = buildLineStarts(text);
  const tagCount = matcher.tags.length;

  const slre = matcher.singleLine;
  slre.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = slre.exec(text)) !== null) {
    const { tagIndex, tagText } = pickTag(m, tagCount);
    if (tagIndex < 0) continue;
    const tagOffset = m.index + m[0].indexOf(tagText);
    if (used.has(tagOffset)) continue;
    used.add(tagOffset);

    let message = (m[tagCount + 1] ?? "").trim().replace(TRAIL_RE, "");
    if (!message) message = tagText;

    results.push({
      tagIndex,
      message,
      range: span(lineStarts, m.index, m.index + m[0].length),
      tagRange: span(lineStarts, tagOffset, tagOffset + tagText.length),
    });
  }

  if (!multiline) return results;

  const blockRe = matcher.block;
  blockRe.lastIndex = 0;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(text)) !== null) {
    const [, lead, delimiter, inner] = bm;
    if (!inner.includes("\n")) continue; // single-line blocks are handled by the single-line pass
    const baseOffset = bm.index + lead.length + delimiter.length;

    const innerRe = matcher.blockInner;
    innerRe.lastIndex = 0;
    let im: RegExpExecArray | null;
    while ((im = innerRe.exec(inner)) !== null) {
      const { tagIndex, tagText } = pickTag(im, tagCount);
      if (tagIndex < 0) continue;
      const tagOffsetInLine = im[0].indexOf(tagText);
      if (tagOffsetInLine < 0) continue;
      const tagOffset = baseOffset + im.index + tagOffsetInLine;
      if (used.has(tagOffset)) continue;
      used.add(tagOffset);

      let message = (im[tagCount + 1] ?? "").trim();
      if (!message) message = tagText;

      results.push({
        tagIndex,
        message,
        range: span(lineStarts, tagOffset, baseOffset + im.index + im[0].length),
        tagRange: span(lineStarts, tagOffset, tagOffset + tagText.length),
      });
    }
  }

  return results;
}

// converts a VS Code-style glob (** * ? {a,b}) into an anchored RegExp. Paths are matched
// with forward slashes. Used for the editor-side comments.exclude check (bulk scanning
// delegates to workspace.findFiles' exclude argument).
export function globToRegExp(glob: string): RegExp {
  const g = glob.replace(/\\/g, "/");
  let re = "";
  let depth = 0;
  let i = 0;
  while (i < g.length) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?"; // **/ → any number of leading path segments (including none)
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*"; // * → within a single segment
        i += 1;
      }
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if (c === "{") {
      re += "(?:";
      depth += 1;
      i += 1;
    } else if (c === "}" && depth > 0) {
      re += ")";
      depth -= 1;
      i += 1;
    } else if (c === "," && depth > 0) {
      re += "|";
      i += 1;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

export function isExcluded(path: string, excludeRes: RegExp[]): boolean {
  const p = path.replace(/\\/g, "/");
  return excludeRes.some((re) => re.test(p));
}
