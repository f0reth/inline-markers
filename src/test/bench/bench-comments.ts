import * as vscode from "vscode";

import { createBetterComments } from "../../comments";
import { BenchResult, loadFixtureDocuments, measure, printResults } from "./utils";

function makeSource(lines: number): string {
  const parts: string[] = [];
  for (let i = 0; i < lines; i++) {
    if (i % 20 === 0) {
      parts.push(`// TODO: fix this on line ${i}`);
    } else if (i % 20 === 5) {
      parts.push(`// FIXME: broken since forever ${i}`);
    } else {
      parts.push(`const x${i} = ${i};`);
    }
  }
  return parts.join("\n");
}

export async function runCommentsBench() {
  const ext = vscode.extensions.getExtension("f0reth.inline-markers")!;
  await ext.activate();

  const better = createBetterComments();
  const results: BenchResult[] = [];

  for (const lineCount of [100, 1000, 10000]) {
    const src = makeSource(lineCount);
    const doc = await vscode.workspace.openTextDocument({ content: src, language: "typescript" });
    await vscode.window.showTextDocument(doc);

    const result = await measure(`comments analyzeDocument (${lineCount} lines)`, () => {
      better.analyzeDocument(doc);
    });
    results.push(result);
  }

  const fixtureDocs = await loadFixtureDocuments();
  const totalLines = fixtureDocs.reduce((s, d) => s + d.lineCount, 0);
  const multiFileResult = await measure(
    `comments analyzeDocument (10 files, ${totalLines} lines)`,
    () => {
      for (const doc of fixtureDocs) {
        better.analyzeDocument(doc);
      }
    },
  );
  results.push(multiFileResult);

  better.dispose();
  printResults(results, "comments");
}
