import {
  DecorationOptions,
  DiagnosticSeverity,
  ExtensionContext,
  Range,
  TextEditor,
  languages,
  window,
  workspace,
} from "vscode";

import { createBetterComments } from "./comments";
import { ILineOptions, createDiagnosticLine } from "./diagnostic-line";
import { createGutterDecorators } from "./gutter";

export function activate(context: ExtensionContext) {
  const gutters = createGutterDecorators(context);
  context.subscriptions.push(
    gutters.errorGutter,
    gutters.warnGutter,
    gutters.infoGutter,
    gutters.hintGutter,
  );

  const diagLine = createDiagnosticLine();
  context.subscriptions.push({ dispose: () => diagLine.dispose() });

  const better = createBetterComments(context);

  let gutterEnabled = true;

  function updateSettings() {
    const config = workspace.getConfiguration("inline-markers");
    gutterEnabled = config.get("gutter.enabled", true);
    diagLine.updateSettings({
      showLine: config.get("diagnosticLine.enabled", true),
      errorLabelBg: config.get("diagnosticLine.errorLabelBg", "#d32f2f88"),
      warnLabelBg: config.get("diagnosticLine.warnLabelBg", "#ff980088"),
      errFontColor: config.get("diagnosticLine.errFontColor", "#efefef"),
      warnFontColor: config.get("diagnosticLine.warnFontColor", "#000000"),
      maxLineLength: config.get("diagnosticLine.maxLineLength", 120),
    });
    better.updateSettingsAndRecreate();
  }

  updateSettings();

  function updateAll(editor: TextEditor | undefined) {
    if (!editor) return;

    const diagnostics = languages.getDiagnostics(editor.document.uri);
    const severityMap = new Map<DiagnosticSeverity, DecorationOptions[]>([
      [DiagnosticSeverity.Error, []],
      [DiagnosticSeverity.Warning, []],
      [DiagnosticSeverity.Information, []],
      [DiagnosticSeverity.Hint, []],
    ]);
    const lineOptions: ILineOptions[] = [];

    for (const d of diagnostics) {
      severityMap.get(d.severity)?.push({ range: d.range, hoverMessage: d.message });
      const lineEnd = editor.document.lineAt(d.range.start.line).range.end;
      lineOptions.push({
        severity: d.severity,
        message: d.message,
        range: new Range(lineEnd, lineEnd),
      });
    }

    const empty: DecorationOptions[] = [];
    editor.setDecorations(
      gutters.errorGutter,
      gutterEnabled ? severityMap.get(DiagnosticSeverity.Error)! : empty,
    );
    editor.setDecorations(
      gutters.warnGutter,
      gutterEnabled ? severityMap.get(DiagnosticSeverity.Warning)! : empty,
    );
    editor.setDecorations(
      gutters.infoGutter,
      gutterEnabled ? severityMap.get(DiagnosticSeverity.Information)! : empty,
    );
    editor.setDecorations(
      gutters.hintGutter,
      gutterEnabled ? severityMap.get(DiagnosticSeverity.Hint)! : empty,
    );

    diagLine.updateForTextDocument(editor.document.uri, lineOptions);
    diagLine.showLineDecoratorForDocument(editor.document.uri);

    better.analyzeDocument(editor.document.uri);
    better.showForDocument(editor.document.uri);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const scheduleUpdate = (immediate = false) => {
    if (timeout) clearTimeout(timeout);
    if (immediate) {
      updateAll(window.activeTextEditor);
      return;
    }
    timeout = setTimeout(() => updateAll(window.activeTextEditor), 200);
  };

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(() => scheduleUpdate(true)),
    workspace.onDidChangeTextDocument((e) => {
      if (e.document === window.activeTextEditor?.document) scheduleUpdate();
    }),
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("inline-markers")) {
        updateSettings();
        scheduleUpdate(true);
      }
    }),
    languages.onDidChangeDiagnostics(() => scheduleUpdate()),
    { dispose: () => better.dispose() },
  );

  scheduleUpdate(true);
}

export function deactivate() {
  // context.subscriptions に任せる
}
