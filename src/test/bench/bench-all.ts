import * as vscode from "vscode";

import { createBetterComments } from "../../comments";
import { ILineOptions, createDiagnosticLine } from "../../diagnostic-line";
import { createGutterDecorators } from "../../gutter";
import { BenchResult, loadFixtureDocuments, measure, printResults } from "./utils";

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

  const better = createBetterComments();
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
        better.analyzeDocument(doc);
        better.showForDocument(uri);
        editor.setDecorations(gutter.errorGutter, gutterRanges);
        diagLine.updateForTextDocument(uri, diagOpts);
        diagLine.showLineDecoratorForDocument(uri);
      },
    );
    results.push(result);
  }

  const fixtureDocs = await loadFixtureDocuments();
  const totalLines = fixtureDocs.reduce((s, d) => s + d.lineCount, 0);
  const gutterRangesMap = new Map(
    fixtureDocs.map((doc) => [
      doc,
      Array.from({ length: doc.lineCount }, (_, i) => ({ range: new vscode.Range(i, 0, i, 0) })),
    ]),
  );
  const diagOptsMap = new Map(
    fixtureDocs.map((doc) => [
      doc,
      Array.from(
        { length: doc.lineCount },
        (_, i): ILineOptions => ({
          severity:
            i % 2 === 0 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
          message: `Error #${i}`,
          range: new vscode.Range(i, 0, i, 0),
        }),
      ),
    ]),
  );
  const multiFileResult = await measure(
    `all features (10 files, ${totalLines} lines)`,
    async () => {
      for (const doc of fixtureDocs) {
        const ed = await vscode.window.showTextDocument(doc);
        const { uri } = doc;
        better.analyzeDocument(doc);
        better.showForDocument(uri);
        ed.setDecorations(gutter.errorGutter, gutterRangesMap.get(doc)!);
        diagLine.updateForTextDocument(uri, diagOptsMap.get(doc)!);
        diagLine.showLineDecoratorForDocument(uri);
      }
    },
  );
  results.push(multiFileResult);

  better.dispose();
  gutter.dispose();
  diagLine.dispose();
  printResults(results, "all");
}
