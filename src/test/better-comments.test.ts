import * as assert from "node:assert";

import * as vscode from "vscode";

import { createBetterComments, TagMatch } from "../comments";

const stubContext = {
  asAbsolutePath: (p: string) => p,
};

suite("BetterComments — API surface", () => {
  test("createBetterComments returns expected API (6 functions)", () => {
    const bc = createBetterComments(stubContext);
    assert.strictEqual(typeof bc.analyzeDocument, "function");
    assert.strictEqual(typeof bc.showForDocument, "function");
    assert.strictEqual(typeof bc.removeForDocument, "function");
    assert.strictEqual(typeof bc.updateSettingsAndRecreate, "function");
    assert.strictEqual(typeof bc.getTagMatches, "function");
    assert.strictEqual(typeof bc.dispose, "function");
    bc.dispose();
  });
});

suite("BetterComments — dispose", () => {
  test("dispose() does not throw", () => {
    const bc = createBetterComments(stubContext);
    assert.doesNotThrow(() => bc.dispose());
  });

  test("dispose() called twice does not throw", () => {
    const bc = createBetterComments(stubContext);
    assert.doesNotThrow(() => {
      bc.dispose();
      bc.dispose();
    });
  });
});

suite("BetterComments — updateSettingsAndRecreate", () => {
  test("does not throw on first call (already called in constructor)", () => {
    const bc = createBetterComments(stubContext);
    assert.doesNotThrow(() => bc.updateSettingsAndRecreate());
    bc.dispose();
  });

  test("does not throw on repeated calls (decorator recreation idempotent)", () => {
    const bc = createBetterComments(stubContext);
    assert.doesNotThrow(() => {
      bc.updateSettingsAndRecreate();
      bc.updateSettingsAndRecreate();
      bc.updateSettingsAndRecreate();
    });
    bc.dispose();
  });
});

suite("BetterComments — removeForDocument", () => {
  test("does not throw for unknown URI", () => {
    const bc = createBetterComments(stubContext);
    const uri = vscode.Uri.file("/test/unknown.ts");
    assert.doesNotThrow(() => bc.removeForDocument(uri));
    bc.dispose();
  });

  test("does not throw for a URI that was previously analyzed", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO: something",
      language: "typescript",
    });
    bc.analyzeDocument(doc);
    assert.doesNotThrow(() => bc.removeForDocument(doc.uri));
    bc.dispose();
  });
});

suite("BetterComments — showForDocument", () => {
  test("does not throw when there is no active editor", () => {
    const bc = createBetterComments(stubContext);
    const uri = vscode.Uri.file("/test/no-editor.ts");
    assert.doesNotThrow(() => bc.showForDocument(uri));
    bc.dispose();
  });

  test("does not throw for a URI with no cached results", () => {
    const bc = createBetterComments(stubContext);
    const uri = vscode.Uri.file("/test/no-cache.ts");
    assert.doesNotThrow(() => bc.showForDocument(uri));
    bc.dispose();
  });
});

suite("BetterComments — analyzeDocument", () => {
  test("does not throw for a basic TypeScript document", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "const x = 1;",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for a markdown document (languageId in excludeLanguages)", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "<!-- TODO: excluded -->",
      language: "markdown",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("analyzeDocument does not throw for all 5 comment tag types", async () => {
    const bc = createBetterComments(stubContext);
    const cases = [
      { content: "// TODO: fix this", label: "todo" },
      { content: "// FIXME: broken", label: "fixme" },
      { content: "// ! important note", label: "important" },
      { content: "// ? what is this", label: "question" },
      { content: "// * highlighted", label: "highlight" },
    ];
    for (const { content, label } of cases) {
      const doc = await vscode.workspace.openTextDocument({ content, language: "typescript" });
      assert.doesNotThrow(() => bc.analyzeDocument(doc), `should not throw for ${label}`);
    }
    bc.dispose();
  });

  test("does not throw for an empty document", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for a document with a line matching multiple tag patterns", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO: FIXME: both tags",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  // TRAIL_RE strips trailing */ and --> before storing tag text; covered by the two tests below
  test("does not throw for a block comment line ending with */", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "/* TODO: fix */",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for an HTML comment line ending with -->", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "<!-- TODO: fix -->",
      language: "html",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for a comment where tag text has no trailing message", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO:",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw repeated calls on the same URI (idempotent)", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO: repeat",
      language: "typescript",
    });
    assert.doesNotThrow(() => {
      bc.analyzeDocument(doc);
      bc.analyzeDocument(doc);
      bc.analyzeDocument(doc);
    });
    bc.dispose();
  });

  test("does not throw for inline comment (const x = 1; // TODO: fix)", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "const x = 1; // TODO: fix",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for multiline block comment with inner tags", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "/*\n * TODO: implement\n * FIXME: broken\n */",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for JSDoc comment with inner tag", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "/**\n * TODO: document this\n */",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });

  test("does not throw for document with multiple inline comments on different lines", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content:
        "const a = 1; // TODO: fix a\nconst b = 2; // FIXME: fix b\nconst c = 3; // ! important",
      language: "typescript",
    });
    assert.doesNotThrow(() => bc.analyzeDocument(doc));
    bc.dispose();
  });
});

suite("BetterComments — analyzeDocument result verification", () => {
  async function analyze(content: string, language = "typescript") {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({ content, language });
    bc.analyzeDocument(doc);
    const results = bc.getTagMatches(doc.uri);
    bc.dispose();
    return results;
  }

  test('"// TODO: fix this" → key === "todo", length === 1', async () => {
    const results = await analyze("// TODO: fix this");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "todo");
  });

  test('"// FIXME: broken" → key === "fixme", length === 1', async () => {
    const results = await analyze("// FIXME: broken");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "fixme");
  });

  test('"// ! important" → key === "important", length === 1', async () => {
    const results = await analyze("// ! important");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "important");
  });

  test('"// ? question" → key === "question", length === 1', async () => {
    const results = await analyze("// ? question");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "question");
  });

  test('"// * highlight" → key === "highlight", length === 1', async () => {
    const results = await analyze("// * highlight");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "highlight");
  });

  test("mixed tags: 3 lines → 3 results with correct keys", async () => {
    const content = "// TODO: a\n// FIXME: b\n// ! c";
    const results = await analyze(content);
    assert.strictEqual(results.length, 3);
    const keys = results.map((r: TagMatch) => r.key);
    assert.ok(keys.includes("todo"));
    assert.ok(keys.includes("fixme"));
    assert.ok(keys.includes("important"));
  });

  test("excludeLanguages: markdown → getTagMatches returns empty array", async () => {
    const results = await analyze("<!-- TODO: excluded -->", "markdown");
    assert.deepStrictEqual(results, []);
  });

  test("removeForDocument → getTagMatches returns empty array", async () => {
    const bc = createBetterComments(stubContext);
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO: something",
      language: "typescript",
    });
    bc.analyzeDocument(doc);
    assert.strictEqual(bc.getTagMatches(doc.uri).length, 1);
    bc.removeForDocument(doc.uri);
    assert.deepStrictEqual(bc.getTagMatches(doc.uri), []);
    bc.dispose();
  });

  test('"const x = 1; // TODO: fix" (inline) → detected as todo', async () => {
    const results = await analyze("const x = 1; // TODO: fix");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "todo");
  });

  test('multiline block "/*\\n * TODO:\\n */" → key === "todo"', async () => {
    const results = await analyze("/*\n * TODO: implement\n */");
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].key, "todo");
  });
});
