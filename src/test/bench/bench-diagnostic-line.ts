import * as vscode from "vscode";

import { ILineOptions, createDiagnosticLine } from "../../diagnostic-line";
import { BenchResult, loadFixtureDocuments, measure, printResults } from "./utils";

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

  const fixtureDocs = await loadFixtureDocuments();
  const totalLines = fixtureDocs.reduce((s, d) => s + d.lineCount, 0);
  const multiFileResult = await measure(
    `diagnostic-line updateForDoc+showLine (10 files, ${totalLines} lines)`,
    () => {
      for (const fixtureDoc of fixtureDocs) {
        const opts: ILineOptions[] = Array.from({ length: fixtureDoc.lineCount }, (_, i) => ({
          severity:
            i % 2 === 0 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
          message: `Diagnostic #${i}`,
          range: new vscode.Range(i, 0, i, 0),
        }));
        diagLine.updateForTextDocument(fixtureDoc.uri, opts);
        diagLine.showLineDecoratorForDocument(fixtureDoc.uri);
      }
    },
  );
  results.push(multiFileResult);

  diagLine.dispose();
  printResults(results, "diagnostic-line");
}
