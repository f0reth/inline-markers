import {
  DecorationOptions,
  Range,
  TextDocument,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
} from "vscode";

import {
  compileMatcher,
  globToRegExp,
  isExcluded,
  Matcher,
  ScanMatch,
  scanText,
} from "./comment-scanner";
import { DEFAULT_EXCLUDE, DEFAULT_TAGS } from "./configurations";

export type { ScanMatch } from "./comment-scanner";

// Decoration manager for comment tags. Owns one TextEditorDecorationType per configured tag
// and delegates all parsing to the shared, vscode-independent comment-scanner.
export function createBetterComments() {
  let tagDecorators: TextEditorDecorationType[] = [];
  const clearBackgroundDeco = window.createTextEditorDecorationType({
    backgroundColor: "transparent",
  });
  const cache = new Map<string, ScanMatch[]>();

  let matcher: Matcher | undefined;
  let excludeRes: RegExp[] = [];
  let multilineComments = true;

  // reusable option buffers (one array per tag) — reset per show to limit GC pressure
  let perTagOpts: DecorationOptions[][] = [];
  const clearOpts: DecorationOptions[] = [];

  function toRange(p: ScanMatch["range"]): Range {
    return new Range(p.startLine, p.startCharacter, p.endLine, p.endCharacter);
  }

  function analyzeDocument(doc: TextDocument): void {
    if (!matcher) return;
    if (isExcluded(doc.uri.path, excludeRes)) {
      cache.delete(doc.uri.path);
      return;
    }
    cache.set(doc.uri.path, scanText(doc.getText(), matcher, multilineComments));
  }

  function showForDocument(uri: Uri): void {
    const active = window.activeTextEditor;
    if (!active || active.document.uri.path !== uri.path) return;

    for (const arr of perTagOpts) arr.length = 0;
    clearOpts.length = 0;

    const matches = cache.get(uri.path) ?? [];
    for (const m of matches) {
      perTagOpts[m.tagIndex]?.push({ range: toRange(m.range), hoverMessage: m.message });
      clearOpts.push({ range: toRange(m.tagRange) });
    }

    for (let i = 0; i < tagDecorators.length; i++) {
      active.setDecorations(tagDecorators[i], perTagOpts[i] ?? []);
    }
    active.setDecorations(clearBackgroundDeco, clearOpts);
  }

  function removeForDocument(uri: Uri): void {
    cache.delete(uri.path);
  }

  function disposeDecorators(): void {
    for (const d of tagDecorators) d.dispose();
    tagDecorators = [];
  }

  function updateSettingsAndRecreate(): void {
    const config = workspace.getConfiguration("inline-markers.comments");
    const tags = config.get("tags", DEFAULT_TAGS);
    const excludeGlobs = config.get("exclude", DEFAULT_EXCLUDE);
    multilineComments = config.get("multilineComments", true);

    matcher = compileMatcher(tags);
    excludeRes = excludeGlobs.map(globToRegExp);

    disposeDecorators();
    tagDecorators = tags.map((t) => {
      const decoLines: string[] = [];
      if (t.strikethrough) decoLines.push("line-through");
      if (t.underline) decoLines.push("underline");
      return window.createTextEditorDecorationType({
        color: t.color,
        fontWeight: t.bold ? "bold" : undefined,
        fontStyle: t.italic ? "italic" : undefined,
        textDecoration: decoLines.length > 0 ? decoLines.join(" ") : undefined,
      });
    });

    perTagOpts = tags.map(() => []);

    for (const doc of workspace.textDocuments) {
      analyzeDocument(doc);
    }
  }

  function getTagMatches(uri: Uri): ScanMatch[] {
    return cache.get(uri.path) ?? [];
  }

  function dispose(): void {
    disposeDecorators();
    clearBackgroundDeco.dispose();
    cache.clear();
  }

  updateSettingsAndRecreate();

  return {
    analyzeDocument,
    showForDocument,
    removeForDocument,
    updateSettingsAndRecreate,
    getTagMatches,
    dispose,
  };
}
