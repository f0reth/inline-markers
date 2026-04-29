import {
  DecorationOptions,
  DiagnosticSeverity,
  ExtensionContext,
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

  function updateSettings() {
    const config = workspace.getConfiguration("inline-markers");
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
      lineOptions.push({ severity: d.severity, message: d.message, range: d.range });
    }

    const config = workspace.getConfiguration("inline-markers");
    const gutterEnabled = config.get("gutter.enabled", true);

    if (gutterEnabled) {
      editor.setDecorations(gutters.errorGutter, severityMap.get(DiagnosticSeverity.Error)!);
      editor.setDecorations(gutters.warnGutter, severityMap.get(DiagnosticSeverity.Warning)!);
      editor.setDecorations(gutters.infoGutter, severityMap.get(DiagnosticSeverity.Information)!);
      editor.setDecorations(gutters.hintGutter, severityMap.get(DiagnosticSeverity.Hint)!);
    } else {
      editor.setDecorations(gutters.errorGutter, []);
      editor.setDecorations(gutters.warnGutter, []);
      editor.setDecorations(gutters.infoGutter, []);
      editor.setDecorations(gutters.hintGutter, []);
    }

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
