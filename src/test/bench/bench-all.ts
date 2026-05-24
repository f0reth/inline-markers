import * as vscode from "vscode";

import { createBetterComments } from "../../comments";
import { ILineOptions, createDiagnosticLine } from "../../diagnostic-line";
import { createGutterDecorators } from "../../gutter";
import { BenchResult, measure, printResults } from "./utils";

function makeSource(lines: number): string {
  const parts: string[] = [];
  for (let i = 0; i < lines; i++) {
    if (i % 10 === 0) {
      parts.push(`// TODO: fix on line ${i}`);
    } else {
      parts.push(`const v${i} = ${i};`);
    }
  }
  return parts.join("\n");
}

export async function runAllBench() {
  const ext = vscode.extensions.getExtension("f0reth.inline-markers")!;
  await ext.activate();
  const context = {
    asAbsolutePath: (p: string) => vscode.Uri.joinPath(ext.extensionUri, p).fsPath,
  };

  const better = createBetterComments(context);
  const gutter = createGutterDecorators(context);
  const diagLine = createDiagnosticLine();
  diagLine.updateSettings({
    showLine: true,
    errorLabelBg: "#d32f2f88",
    warnLabelBg: "#ff980088",
    errFontColor: "#efefef",
    warnFontColor: "#000000",
    maxLineLength: 120,
  });

  const results: BenchResult[] = [];

  for (const lineCount of [100, 1000, 10000]) {
    const src = makeSource(lineCount);
    const doc = await vscode.workspace.openTextDocument({ content: src, language: "typescript" });
    const editor = await vscode.window.showTextDocument(doc);
    const { uri } = doc;

    const diagOpts: ILineOptions[] = Array.from({ length: lineCount }, (_, i) => ({
      severity: i % 2 === 0 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
      message: `Error message #${i}`,
      range: new vscode.Range(i % doc.lineCount, 0, i % doc.lineCount, 0),
    }));
    const gutterRanges = Array.from({ length: lineCount }, (_, i) => ({
      range: new vscode.Range(i % doc.lineCount, 0, i % doc.lineCount, 0),
    }));

    const result = await measure(
      `all features (${lineCount} lines, ${lineCount} diagnostics)`,
      () => {
        better.analyzeDocument(uri);
        better.showForDocument(uri);
        editor.setDecorations(gutter.errorGutter, gutterRanges);
        diagLine.updateForTextDocument(uri, diagOpts);
        diagLine.showLineDecoratorForDocument(uri);
      },
    );
    results.push(result);
  }

  better.dispose();
  gutter.dispose();
  diagLine.dispose();
  printResults(results, "all");
}
