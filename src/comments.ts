import {
  DecorationOptions,
  ExtensionContext,
  Range,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
} from "vscode";

type ContextLike = Pick<ExtensionContext, "asAbsolutePath">;

import { DEFAULTS } from "./configurations";
import { CommentTagKey, LocalTagConfig } from "./types";

const PATTERNS: Record<CommentTagKey, RegExp> = {
  todo: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*((?:TODO|FIXME)\b[:-]?)\s*(.*)/i,
  fixme: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(FIXME\b[:-]?)\s*(.*)/i,
  important: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(!)(?=\s|$)\s*(.*)/,
  question: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\?)(?=\s|$)\s*(.*)/,
  highlight: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\*)(?=\s|$)\s*(.*)/,
};

const TRAIL_RE = /(?:\s*\*+\/|\s*-->)\s*$/;

export function createBetterComments(context: ContextLike) {
  type Key = CommentTagKey;

  const tagDecorators = new Map<Key, TextEditorDecorationType>();
  const clearBackgroundDeco = window.createTextEditorDecorationType({
    backgroundColor: "transparent",
  });
  const tagLineOptions = new Map<
    string,
    { key: Key; message: string; range: Range; tagRange?: Range }[]
  >();

  let configs: Record<Key, LocalTagConfig> | undefined;
  let excludeLanguages: string[] = ["markdown", "mdx"];

  const TAG_KEYS: Key[] = ["important", "fixme", "todo", "question", "highlight"];

  function analyzeDocument(uri: Uri) {
    if (!configs) return;
    const doc = workspace.textDocuments.find((d) => d.uri.path === uri.path);
    if (!doc) return;

    if (excludeLanguages.includes(doc.languageId)) {
      tagLineOptions.delete(uri.path);
      return;
    }

    const results: { key: Key; message: string; range: Range; tagRange?: Range }[] = [];
    const activeKeys = TAG_KEYS.filter((k) => configs![k].enabled);

    for (let i = 0; i < doc.lineCount; i++) {
      const { text, range } = doc.lineAt(i);
      for (const key of activeKeys) {
        const m = configs[key].pattern.exec(text);
        if (!m) continue;

        const tagText = m[1] ?? m[0];
        let message = (m[2] ?? "").trim().replace(TRAIL_RE, "");
        if (!message) {
          message = tagText;
        }

        const tagIndex = text.indexOf(tagText);
        const tagRange =
          tagIndex !== -1 ? new Range(i, tagIndex, i, tagIndex + tagText.length) : undefined;

        results.push({ key, message, range, tagRange });
        break;
      }
    }
    tagLineOptions.set(uri.path, results);
  }

  function showForDocument(uri: Uri) {
    const active = window.activeTextEditor;
    if (!active || active.document.uri.path !== uri.path) return;

    const perTagOpts = new Map<Key, DecorationOptions[]>();
    for (const key of tagDecorators.keys()) perTagOpts.set(key, []);

    const clearOpts: DecorationOptions[] = [];
    const arr = tagLineOptions.get(uri.path) || [];

    for (const item of arr) {
      perTagOpts.get(item.key)?.push({ range: item.range, hoverMessage: item.message });
      if (item.tagRange) clearOpts.push({ range: item.tagRange });
    }

    for (const [key, deco] of tagDecorators.entries()) {
      active.setDecorations(deco, perTagOpts.get(key) || []);
    }
    active.setDecorations(clearBackgroundDeco, clearOpts);
  }

  function removeForDocument(uri: Uri) {
    tagLineOptions.delete(uri.path);
  }

  function updateSettingsAndRecreate() {
    const config = workspace.getConfiguration("inline-markers.comments");
    excludeLanguages = config.get("excludeLanguages", ["markdown", "mdx"]);
    const buildConfig = (key: Key): LocalTagConfig => ({
      ...DEFAULTS[key],
      pattern: PATTERNS[key],
      enabled: config.get(`${key}.enabled`, DEFAULTS[key].enabled),
      color: config.get(`${key}.color`, DEFAULTS[key].color),
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
      const deco = window.createTextEditorDecorationType({
        color: c.color,
        gutterIconPath: c.gutterIcon ? context.asAbsolutePath(c.gutterIcon) : undefined,
        gutterIconSize: "contain",
      });
      tagDecorators.set(key, deco);
    }

    for (const doc of workspace.textDocuments) {
      analyzeDocument(doc.uri);
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
