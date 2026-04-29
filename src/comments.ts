import {
  DecorationOptions,
  ExtensionContext,
  Range,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
} from "vscode";

import { DEFAULTS } from "./configurations";
import { CommentTagKey, LocalTagConfig } from "./types";

const PATTERNS: Record<CommentTagKey, RegExp> = {
  todo: /(?:\/\/|#|--|^\s*\*|<!--|\/\*+)(?:[\s*!?]*)\s*((?:TODO|FIXME)\b[:-]?)\s*(.*)/i,
  fixme: /(?:\/\/|#|--|^\s*\*|<!--|\/\*+)(?:[\s*!?]*)\s*(FIXME\b[:-]?)\s*(.*)/i,
  important: /(?:\/\/|#|--|^\s*\*|<!--|\/\*+)(?:[\s*!?]*)\s*(!)\s*(.*)/,
  question: /(?:\/\/|#|--|^\s*\*|<!--|\/\*+)(?:[\s*!?]*)\s*(\?)\s*(.*)/,
  highlight: /(?:\/\/|#|--|^\s*\*|<!--|\/\*+)(?:[\s*!?]*)\s*(\*)\s*(.*)/,
};

export function createBetterComments(context: ExtensionContext) {
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

  const TAG_KEYS: Key[] = ["important", "fixme", "todo", "question", "highlight"];

  function analyzeDocument(uri: Uri) {
    if (!configs) return;
    const doc = workspace.textDocuments.find((d) => d.uri.path === uri.path);
    if (!doc) return;

    const results: { key: Key; message: string; range: Range; tagRange?: Range }[] = [];
    const activeKeys = TAG_KEYS.filter((k) => configs![k].enabled);

    for (let i = 0; i < doc.lineCount; i++) {
      const { text, range } = doc.lineAt(i);
      for (const key of activeKeys) {
        const m = configs[key].pattern.exec(text);
        if (!m) continue;

        const tagText = m[1] ?? m[0];
        let message = (m[2] ?? "").trim().replace(/(?:\s*\*+\/|\s*-->)\s*$/, "");
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
    configs = {
      todo: {
        ...DEFAULTS.todo,
        pattern: PATTERNS.todo,
        enabled: config.get("todo.enabled", DEFAULTS.todo.enabled),
        color: config.get("todo.color", DEFAULTS.todo.color),
      },
      fixme: {
        ...DEFAULTS.fixme,
        pattern: PATTERNS.fixme,
        enabled: config.get("fixme.enabled", DEFAULTS.fixme.enabled),
        color: config.get("fixme.color", DEFAULTS.fixme.color),
      },
      important: {
        ...DEFAULTS.important,
        pattern: PATTERNS.important,
        enabled: config.get("important.enabled", DEFAULTS.important.enabled),
        color: config.get("important.color", DEFAULTS.important.color),
      },
      question: {
        ...DEFAULTS.question,
        pattern: PATTERNS.question,
        enabled: config.get("question.enabled", DEFAULTS.question.enabled),
        color: config.get("question.color", DEFAULTS.question.color),
      },
      highlight: {
        ...DEFAULTS.highlight,
        pattern: PATTERNS.highlight,
        enabled: config.get("highlight.enabled", DEFAULTS.highlight.enabled),
        color: config.get("highlight.color", DEFAULTS.highlight.color),
      },
    };

    tagDecorators.forEach((d) => {
      d.dispose();
    });
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
    tagDecorators.forEach((d) => {
      d.dispose();
    });
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
