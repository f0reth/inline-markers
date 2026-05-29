import {
  DecorationOptions,
  ExtensionContext,
  Range,
  TextDocument,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
} from "vscode";

type ContextLike = Pick<ExtensionContext, "asAbsolutePath">;

import { DEFAULTS } from "./configurations";
import { CommentTagKey, LocalTagConfig } from "./types";

// order determines match priority: earlier keys win when multiple patterns could match
const TAG_KEYS: CommentTagKey[] = ["important", "fixme", "todo", "question", "highlight"];

// single-line comment patterns (no ^ anchor — matches inline comments too)
// \/\*+ handles single-line block comments like /* TODO: fix */
const SINGLE_LINE_PATTERNS: Record<CommentTagKey, RegExp> = {
  todo: /(?:\/\/|#|--|<!--|\/\*+)(?:[ \t*!?]*)[ \t]*((?:TODO|FIXME)\b[:-]?)[ \t]*(.*)/i,
  fixme: /(?:\/\/|#|--|<!--|\/\*+)(?:[ \t*!?]*)[ \t]*(FIXME\b[:-]?)[ \t]*(.*)/i,
  important: /(?:\/\/|#|--|<!--|\/\*+)(?:[ \t*!?]*)[ \t]*(!)(?=[ \t]|$)([ \t]*.*)/,
  question: /(?:\/\/|#|--|<!--|\/\*+)(?:[ \t*!?]*)[ \t]*(\?)(?=[ \t]|$)([ \t]*.*)/,
  highlight: /(?:\/\/|#|--|<!--|\/\*+)(?:[ \t*!?]*)[ \t]*(\*)(?=[ \t]|$)([ \t]*.*)/,
};

// block comment inner-line patterns (applied per-line inside /* */ and /** */ blocks)
const BLOCK_INNER_PATTERNS: Record<CommentTagKey, RegExp> = {
  todo: /^[ \t]*\*?[ \t]*((?:TODO|FIXME)\b[:-]?)\s*(.*)/im,
  fixme: /^[ \t]*\*?[ \t]*(FIXME\b[:-]?)\s*(.*)/im,
  important: /^[ \t]*\*?[ \t]*(!)(?=\s|$)\s*(.*)/m,
  question: /^[ \t]*\*?[ \t]*(\?)(?=\s|$)\s*(.*)/m,
  highlight: /^[ \t]*\*?[ \t]*(\*)(?=\s|$)\s*(.*)/m,
};

// strips trailing block-comment closers (*/, -->) before storing the message text
const TRAIL_RE = /(?:\s*\*+\/|\s*-->)\s*$/;

type Key = CommentTagKey;
type TagMatch = { key: Key; message: string; range: Range; tagRange: Range };

function findSingleLineComments(
  text: string,
  doc: TextDocument,
  results: TagMatch[],
  configs: Record<Key, LocalTagConfig>,
  usedOffsets: Set<number>,
) {
  for (const key of TAG_KEYS) {
    if (!configs[key].enabled) continue;
    const re = new RegExp(SINGLE_LINE_PATTERNS[key].source, "ig");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const tagText = m[1] ?? m[0];
      const tagAbsOffset = m.index + m[0].indexOf(tagText);
      if (usedOffsets.has(tagAbsOffset)) continue;
      usedOffsets.add(tagAbsOffset);

      let message = (m[2] ?? "").trim().replace(TRAIL_RE, "");
      if (!message) message = tagText;

      const startPos = doc.positionAt(m.index);
      const endPos = doc.positionAt(m.index + m[0].length);
      const range = new Range(startPos, endPos);

      const tagPos = doc.positionAt(tagAbsOffset);
      const tagRange = new Range(tagPos, doc.positionAt(tagAbsOffset + tagText.length));

      results.push({ key, message, range, tagRange });
    }
  }
}

function findBlockComments(
  text: string,
  doc: TextDocument,
  results: TagMatch[],
  configs: Record<Key, LocalTagConfig>,
  usedOffsets: Set<number>,
) {
  // matches /* ... */ blocks (non-JSDoc); group1=leading whitespace, group2=delimiter+first char, group3=inner text
  const blockRe = /(^|[ \t])(\/\*[^*])([\s\S]*?)(\*\/)/gm;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(text)) !== null) {
    const [, g1, g2, innerText] = blockMatch;
    // single-line blocks are handled by findSingleLineComments
    if (!innerText.includes("\n")) continue;
    const baseOffset = blockMatch.index + g1.length + g2.length;
    for (const key of TAG_KEYS) {
      if (!configs[key].enabled) continue;
      const innerRe = new RegExp(BLOCK_INNER_PATTERNS[key].source, "gim");
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerRe.exec(innerText)) !== null) {
        const [fullMatch, tagKeyword, rawMsg] = innerMatch;
        const tagOffsetInLine = fullMatch.indexOf(tagKeyword);
        if (tagOffsetInLine < 0) continue;
        const tagOffset = baseOffset + innerMatch.index + tagOffsetInLine;
        if (usedOffsets.has(tagOffset)) continue;
        usedOffsets.add(tagOffset);

        let message = (rawMsg ?? "").trim();
        if (!message) message = tagKeyword;

        const tagPos = doc.positionAt(tagOffset);
        const tagRange = new Range(tagPos, doc.positionAt(tagOffset + tagKeyword.length));
        const rangeEnd = doc.positionAt(baseOffset + innerMatch.index + fullMatch.length);
        const range = new Range(tagPos, rangeEnd);

        results.push({ key, message, range, tagRange });
      }
    }
  }
}

function findJSDocComments(
  text: string,
  doc: TextDocument,
  results: TagMatch[],
  configs: Record<Key, LocalTagConfig>,
  usedOffsets: Set<number>,
) {
  const blockRe = /(^|[ \t])(\/\*\*)([\s\S]*?)(\*\/)/gm;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(text)) !== null) {
    const [, g1, g2, innerText] = blockMatch;
    if (!innerText.includes("\n")) continue;
    const baseOffset = blockMatch.index + g1.length + g2.length;
    for (const key of TAG_KEYS) {
      if (!configs[key].enabled) continue;
      const innerRe = new RegExp(BLOCK_INNER_PATTERNS[key].source, "gim");
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerRe.exec(innerText)) !== null) {
        const [fullMatch, tagKeyword, rawMsg] = innerMatch;
        const tagOffsetInLine = fullMatch.indexOf(tagKeyword);
        if (tagOffsetInLine < 0) continue;
        const tagOffset = baseOffset + innerMatch.index + tagOffsetInLine;
        if (usedOffsets.has(tagOffset)) continue;
        usedOffsets.add(tagOffset);

        let message = (rawMsg ?? "").trim();
        if (!message) message = tagKeyword;

        const tagPos = doc.positionAt(tagOffset);
        const tagRange = new Range(tagPos, doc.positionAt(tagOffset + tagKeyword.length));
        const rangeEnd = doc.positionAt(baseOffset + innerMatch.index + fullMatch.length);
        const range = new Range(tagPos, rangeEnd);

        results.push({ key, message, range, tagRange });
      }
    }
  }
}

export function createBetterComments(context: ContextLike) {
  const tagDecorators = new Map<Key, TextEditorDecorationType>();
  const clearBackgroundDeco = window.createTextEditorDecorationType({
    backgroundColor: "transparent",
  });
  const tagLineOptions = new Map<string, TagMatch[]>();

  let configs: Record<Key, LocalTagConfig> | undefined;
  let excludeLanguages: string[] = ["markdown", "mdx"];
  let multilineComments = true;

  const perTagOpts = new Map<Key, DecorationOptions[]>();
  const clearOpts: DecorationOptions[] = [];

  function analyzeDocument(doc: TextDocument) {
    if (!configs) return;

    if (excludeLanguages.includes(doc.languageId)) {
      tagLineOptions.delete(doc.uri.path);
      return;
    }

    const text = doc.getText();
    const results: TagMatch[] = [];
    const usedOffsets = new Set<number>();

    findSingleLineComments(text, doc, results, configs, usedOffsets);
    if (multilineComments) {
      findBlockComments(text, doc, results, configs, usedOffsets);
      findJSDocComments(text, doc, results, configs, usedOffsets);
    }

    tagLineOptions.set(doc.uri.path, results);
  }

  function showForDocument(uri: Uri) {
    const active = window.activeTextEditor;
    if (!active || active.document.uri.path !== uri.path) return;

    for (const arr of perTagOpts.values()) arr.length = 0;
    clearOpts.length = 0;

    const arr = tagLineOptions.get(uri.path) ?? [];

    for (const item of arr) {
      perTagOpts.get(item.key)!.push({ range: item.range, hoverMessage: item.message });
      clearOpts.push({ range: item.tagRange });
    }

    for (const [key, deco] of tagDecorators.entries()) {
      active.setDecorations(deco, perTagOpts.get(key) ?? []);
    }
    active.setDecorations(clearBackgroundDeco, clearOpts);
  }

  function removeForDocument(uri: Uri) {
    tagLineOptions.delete(uri.path);
  }

  function updateSettingsAndRecreate() {
    const config = workspace.getConfiguration("inline-markers.comments");
    excludeLanguages = config.get("excludeLanguages", ["markdown", "mdx"]);
    multilineComments = config.get("multilineComments", true);
    const buildConfig = (key: Key): LocalTagConfig => ({
      ...DEFAULTS[key],
      enabled: config.get(`${key}.enabled`, DEFAULTS[key].enabled),
      color: config.get(`${key}.color`, DEFAULTS[key].color),
      bold: config.get(`${key}.bold`, DEFAULTS[key].bold),
      italic: config.get(`${key}.italic`, DEFAULTS[key].italic),
      strikethrough: config.get(`${key}.strikethrough`, DEFAULTS[key].strikethrough),
      underline: config.get(`${key}.underline`, DEFAULTS[key].underline),
    });
    const newConfigs: Record<Key, LocalTagConfig> = {
      important: buildConfig("important"),
      fixme: buildConfig("fixme"),
      todo: buildConfig("todo"),
      question: buildConfig("question"),
      highlight: buildConfig("highlight"),
    };
    configs = newConfigs;

    for (const d of tagDecorators.values()) {
      d.dispose();
    }
    tagDecorators.clear();

    for (const key of TAG_KEYS) {
      const c = configs[key];
      if (!c.enabled) continue;

      const decoLines: string[] = [];
      if (c.strikethrough) decoLines.push("line-through");
      if (c.underline) decoLines.push("underline");
      const deco = window.createTextEditorDecorationType({
        color: c.color,
        fontWeight: c.bold ? "bold" : undefined,
        fontStyle: c.italic ? "italic" : undefined,
        textDecoration: decoLines.length > 0 ? decoLines.join(" ") : undefined,
        gutterIconPath: c.gutterIcon ? context.asAbsolutePath(c.gutterIcon) : undefined,
        gutterIconSize: "contain",
      });
      tagDecorators.set(key, deco);
    }

    perTagOpts.clear();
    for (const k of tagDecorators.keys()) perTagOpts.set(k, []);

    for (const doc of workspace.textDocuments) {
      analyzeDocument(doc);
    }
  }

  function dispose() {
    for (const d of tagDecorators.values()) {
      d.dispose();
    }
    tagDecorators.clear();
    clearBackgroundDeco.dispose();
    tagLineOptions.clear();
  }

  updateSettingsAndRecreate();

  return {
    analyzeDocument,
    showForDocument,
    removeForDocument,
    updateSettingsAndRecreate,
    dispose,
  };
}
