import {
  DecorationOptions,
  DiagnosticSeverity,
  ExtensionContext,
  Range,
  TextEditor,
  TextEditorDecorationType,
  languages,
  window,
  workspace,
} from "vscode";

import { createBetterComments } from "./comments";
import { ILineOptions, createDiagnosticLine } from "./diagnostic-line";
import { createGutterDecorators } from "./gutter";

export let activationDuration = -1;

const EMPTY_DECO_OPTS: DecorationOptions[] = [];

export function activate(context: ExtensionContext) {
  const _activateStart = performance.now();
  const gutters = createGutterDecorators(context);
  context.subscriptions.push({ dispose: () => gutters.dispose() });

  const diagLine = createDiagnosticLine();
  context.subscriptions.push({ dispose: () => diagLine.dispose() });

  const better = createBetterComments(context);

  const gutterPairs: [TextEditorDecorationType, DiagnosticSeverity][] = [
    [gutters.errorGutter, DiagnosticSeverity.Error],
    [gutters.warnGutter, DiagnosticSeverity.Warning],
    [gutters.infoGutter, DiagnosticSeverity.Information],
    [gutters.hintGutter, DiagnosticSeverity.Hint],
  ];

  let gutterEnabled = true;

  const severityMap = new Map<DiagnosticSeverity, DecorationOptions[]>([
    [DiagnosticSeverity.Error, []],
    [DiagnosticSeverity.Warning, []],
    [DiagnosticSeverity.Information, []],
    [DiagnosticSeverity.Hint, []],
  ]);
  const lineOptions: ILineOptions[] = [];

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

  function updateDiagnosticsOnly(editor: TextEditor | undefined) {
    if (!editor) return;

    const diagnostics = languages.getDiagnostics(editor.document.uri);
    for (const arr of severityMap.values()) arr.length = 0;
    lineOptions.length = 0;

    for (const d of diagnostics) {
      severityMap.get(d.severity)?.push({ range: d.range, hoverMessage: d.message });
      const lineEnd = editor.document.lineAt(d.range.start.line).range.end;
      lineOptions.push({
        severity: d.severity,
        message: d.message,
        range: new Range(lineEnd, lineEnd),
      });
    }

    for (const [gutter, severity] of gutterPairs) {
      editor.setDecorations(gutter, gutterEnabled ? severityMap.get(severity)! : EMPTY_DECO_OPTS);
    }

    diagLine.updateForTextDocument(editor.document.uri, lineOptions);
    diagLine.showLineDecoratorForDocument(editor.document.uri);
  }

  function updateAll(editor: TextEditor | undefined) {
    if (!editor) return;
    updateDiagnosticsOnly(editor);
    better.analyzeDocument(editor.document.uri);
    better.showForDocument(editor.document.uri);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let diagTimeout: ReturnType<typeof setTimeout> | undefined;

  const scheduleUpdate = (immediate = false) => {
    if (timeout) clearTimeout(timeout);
    if (immediate) {
      updateAll(window.activeTextEditor);
      return;
    }
    timeout = setTimeout(() => updateAll(window.activeTextEditor), 200);
  };

  const scheduleDiagnosticsUpdate = () => {
    if (diagTimeout) clearTimeout(diagTimeout);
    diagTimeout = setTimeout(() => updateDiagnosticsOnly(window.activeTextEditor), 200);
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
    languages.onDidChangeDiagnostics(() => scheduleDiagnosticsUpdate()),
    { dispose: () => better.dispose() },
  );

  scheduleUpdate(true);
  activationDuration = performance.now() - _activateStart;
  return { activationDuration };
}

export function deactivate() {
  // context.subscriptions に任せる
}
