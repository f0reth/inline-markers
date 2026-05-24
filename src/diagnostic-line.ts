import {
  DecorationOptions,
  DiagnosticSeverity,
  Disposable,
  Range,
  TextEditorDecorationType,
  Uri,
  window,
} from "vscode";

export interface ILineOptions {
  severity: DiagnosticSeverity;
  message: string;
  range: Range;
}

export interface IDiagnosticLineSettings {
  showLine: boolean;
  errorLabelBg: string;
  warnLabelBg: string;
  errFontColor: string;
  warnFontColor: string;
  maxLineLength: number;
}

export function createDiagnosticLine() {
  const lineDecorators = new Map<DiagnosticSeverity, TextEditorDecorationType>();
  const lineOpts = new Map<string, ILineOptions[]>();
  const disposables: Disposable[] = [];
  let settings: IDiagnosticLineSettings = {
    showLine: false,
    errorLabelBg: "#d32f2f88",
    warnLabelBg: "#ff980088",
    errFontColor: "#efefef",
    warnFontColor: "#000000",
    maxLineLength: 0,
  };

  const defaultDecoration = window.createTextEditorDecorationType({});
  disposables.push(defaultDecoration);

  function updateSettings(newSettings: IDiagnosticLineSettings) {
    settings = newSettings;

    for (const deco of lineDecorators.values()) deco.dispose();
    lineDecorators.clear();

    if (!settings.showLine) return;

    const createDeco = (bgColor: string, color: string) =>
      window.createTextEditorDecorationType({
        after: { margin: "0 0 0 30px", backgroundColor: bgColor, color },
      });

    const errorDeco = createDeco(settings.errorLabelBg, settings.errFontColor);
    const warnDeco = createDeco(settings.warnLabelBg, settings.warnFontColor);

    lineDecorators.set(DiagnosticSeverity.Error, errorDeco);
    lineDecorators.set(DiagnosticSeverity.Warning, warnDeco);
    disposables.push(errorDeco, warnDeco);
  }

  function updateForTextDocument(uri: Uri, opts: ILineOptions[]) {
    lineOpts.set(uri.path, opts);
  }

  function showLineDecoratorForDocument(uri: Uri) {
    if (!settings.showLine) return;
    const active = window.activeTextEditor;
    const opts = lineOpts.get(uri.path);
    if (!active || !opts || active.document.uri.path !== uri.path) return;

    const categorizedOpts = new Map<DiagnosticSeverity, DecorationOptions[]>();
    for (const key of lineDecorators.keys()) {
      categorizedOpts.set(key, []);
    }

    for (const { severity, message: rawMessage, range } of opts) {
      if (!categorizedOpts.has(severity)) continue;

      let message = rawMessage;
      if (settings.maxLineLength > 0 && message.length > settings.maxLineLength) {
        message = `${message.substring(0, settings.maxLineLength)}...`;
      }

      categorizedOpts.get(severity)?.push({
        range,
        renderOptions: { after: { contentText: `\u00a0${message}\u00a0` } },
      });
    }

    for (const [severity, deco] of lineDecorators.entries()) {
      const decOpts = categorizedOpts.get(severity) || [];
      active.setDecorations(deco, decOpts);
    }
  }

  function removeForTextDocument(uri: Uri) {
    lineOpts.delete(uri.path);
  }

  function dispose() {
    for (const d of disposables) d.dispose();
    for (const d of lineDecorators.values()) d.dispose();
  }

  return {
    updateSettings,
    updateForTextDocument,
    showLineDecoratorForDocument,
    removeForTextDocument,
    dispose,
  };
}
