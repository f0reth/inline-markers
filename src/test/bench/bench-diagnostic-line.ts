import * as vscode from "vscode";

import { ILineOptions, createDiagnosticLine } from "../../diagnostic-line";
import { BenchResult, measure, printResults } from "./utils";

function makeDiagnosticOpts(count: number, lineCount: number): ILineOptions[] {
  return Array.from({ length: count }, (_, i) => ({
    severity: i % 2 === 0 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    message: `Diagnostic message #${i}`,
    range: new vscode.Range(i % lineCount, 0, i % lineCount, 0),
  }));
}

export async function runDiagnosticLineBench() {
  const diagLine = createDiagnosticLine();
  diagLine.updateSettings({
    showLine: true,
    errorLabelBg: "#d32f2f88",
    warnLabelBg: "#ff980088",
    errFontColor: "#efefef",
    warnFontColor: "#000000",
    maxLineLength: 120,
  });

  const lineCount = 10001;
  const doc = await vscode.workspace.openTextDocument({
    content: "\n".repeat(lineCount),
    language: "plaintext",
  });
  await vscode.window.showTextDocument(doc);
  const { uri } = doc;

  const results: BenchResult[] = [];

  for (const count of [100, 1000, 10000]) {
    const opts = makeDiagnosticOpts(count, lineCount);
    const result = await measure(
      `diagnostic-line updateForDoc+showLine (${count} diagnostics)`,
      () => {
        diagLine.updateForTextDocument(uri, opts);
        diagLine.showLineDecoratorForDocument(uri);
      },
    );
    results.push(result);
  }

  diagLine.dispose();
  printResults(results);
}
