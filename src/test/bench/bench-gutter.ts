import * as vscode from "vscode";

import { createGutterDecorators } from "../../gutter";
import { BenchResult, loadFixtureDocuments, measure, printResults } from "./utils";

function makeDiagnosticRanges(count: number): vscode.DecorationOptions[] {
  return Array.from({ length: count }, (_, i) => ({
    range: new vscode.Range(i, 0, i, 0),
  }));
}

export async function runGutterBench() {
  const ext = vscode.extensions.getExtension("f0reth.inline-markers")!;
  await ext.activate();
  const context = {
    asAbsolutePath: (p: string) => vscode.Uri.joinPath(ext.extensionUri, p).fsPath,
  };

  const gutter = createGutterDecorators(context);

  const doc = await vscode.workspace.openTextDocument({
    content: "\n".repeat(10001),
    language: "plaintext",
  });
  const editor = await vscode.window.showTextDocument(doc);

  const results: BenchResult[] = [];

  for (const count of [100, 1000, 10000]) {
    const ranges = makeDiagnosticRanges(count);
    const result = await measure(`gutter setDecorations (${count} errors)`, () => {
      editor.setDecorations(gutter.errorGutter, ranges);
    });
    results.push(result);
  }

  const fixtureDocs = await loadFixtureDocuments();
  const totalLines = fixtureDocs.reduce((s, d) => s + d.lineCount, 0);
  const rangesMap = new Map(
    fixtureDocs.map((fixtureDoc) => [
      fixtureDoc,
      Array.from({ length: fixtureDoc.lineCount }, (_, i) => ({
        range: new vscode.Range(i, 0, i, 0),
      })),
    ]),
  );
  const multiFileResult = await measure(
    `gutter setDecorations (10 files, ${totalLines} lines)`,
    async () => {
      for (const fixtureDoc of fixtureDocs) {
        const ed = await vscode.window.showTextDocument(fixtureDoc);
        ed.setDecorations(gutter.errorGutter, rangesMap.get(fixtureDoc)!);
      }
    },
  );
  results.push(multiFileResult);

  gutter.dispose();
  printResults(results, "gutter");
}
