import * as assert from "node:assert";

import * as vscode from "vscode";

import { createBetterComments, ScanMatch } from "../comments";

// default tag order: TODO=0, FIXME=1, !=2, ?=3, *=4
suite("BetterComments — API surface", () => {
  test("createBetterComments returns the expected API (6 functions)", () => {
    const bc = createBetterComments();
    assert.strictEqual(typeof bc.analyzeDocument, "function");
    assert.strictEqual(typeof bc.showForDocument, "function");
    assert.strictEqual(typeof bc.removeForDocument, "function");
    assert.strictEqual(typeof bc.updateSettingsAndRecreate, "function");
    assert.strictEqual(typeof bc.getTagMatches, "function");
    assert.strictEqual(typeof bc.dispose, "function");
    bc.dispose();
  });
});

suite("BetterComments — lifecycle", () => {
  test("dispose() and double dispose() do not throw", () => {
    const bc = createBetterComments();
    assert.doesNotThrow(() => {
      bc.dispose();
      bc.dispose();
    });
  });

  test("updateSettingsAndRecreate() is idempotent", () => {
    const bc = createBetterComments();
    assert.doesNotThrow(() => {
      bc.updateSettingsAndRecreate();
      bc.updateSettingsAndRecreate();
    });
    bc.dispose();
  });

  test("removeForDocument / showForDocument do not throw for unknown URIs", () => {
    const bc = createBetterComments();
    const uri = vscode.Uri.file("/test/unknown.ts");
    assert.doesNotThrow(() => bc.removeForDocument(uri));
    assert.doesNotThrow(() => bc.showForDocument(uri));
    bc.dispose();
  });
});

suite("BetterComments — analyzeDocument / getTagMatches", () => {
  async function analyze(content: string, language = "typescript"): Promise<ScanMatch[]> {
    const bc = createBetterComments();
    const doc = await vscode.workspace.openTextDocument({ content, language });
    bc.analyzeDocument(doc);
    const results = bc.getTagMatches(doc.uri);
    bc.dispose();
    return results;
  }

  test("each default tag maps to its array index", async () => {
    assert.strictEqual((await analyze("// TODO: fix"))[0].tagIndex, 0);
    assert.strictEqual((await analyze("// FIXME: bug"))[0].tagIndex, 1);
    assert.strictEqual((await analyze("// ! important"))[0].tagIndex, 2);
    assert.strictEqual((await analyze("// ? question"))[0].tagIndex, 3);
    assert.strictEqual((await analyze("// * highlight"))[0].tagIndex, 4);
  });

  test("single TODO yields one match with stripped message", async () => {
    const r = await analyze("// TODO: fix this");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].message, "fix this");
  });

  test("mixed tags on separate lines → 3 results in order", async () => {
    const r = await analyze("// TODO: a\n// FIXME: b\n// ! c");
    assert.deepStrictEqual(
      r.map((x) => x.tagIndex),
      [0, 1, 2],
    );
  });

  test("inline comment after code is detected", async () => {
    const r = await analyze("const x = 1; // TODO: fix");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].tagIndex, 0);
  });

  test("block comment tag detected", async () => {
    const r = await analyze("/*\n * TODO: implement\n */");
    assert.ok(r.some((x) => x.tagIndex === 0));
  });

  test("JSDoc comment tag detected", async () => {
    const r = await analyze("/**\n * FIXME: document\n */");
    assert.ok(r.some((x) => x.tagIndex === 1));
  });

  test("range.start.line reflects the matched line", async () => {
    const r = await analyze("// skip\n// TODO: on line 1");
    const todo = r.find((x) => x.tagIndex === 0);
    assert.ok(todo);
    assert.strictEqual(todo.range.startLine, 1);
  });

  test("trailing */ stripped from a single-line block message", async () => {
    const r = await analyze("/* TODO: fix */");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].message, "fix");
  });

  test("empty document → empty results", async () => {
    assert.deepStrictEqual(await analyze(""), []);
  });

  test("repeated analyzeDocument reflects last state (not accumulated)", async () => {
    const bc = createBetterComments();
    const doc = await vscode.workspace.openTextDocument({
      content: "// TODO: repeat",
      language: "typescript",
    });
    bc.analyzeDocument(doc);
    bc.analyzeDocument(doc);
    bc.analyzeDocument(doc);
    assert.strictEqual(bc.getTagMatches(doc.uri).length, 1);
    bc.dispose();
  });

  test("removeForDocument clears cached matches", async () => {
    const bc = createBetterComments();
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
});
