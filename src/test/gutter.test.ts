import * as assert from "node:assert";

import * as vscode from "vscode";

import { createGutterDecorators } from "../gutter";

const stubContext = {
  asAbsolutePath: (p: string) => p,
} as unknown as vscode.ExtensionContext;

suite("GutterDecorators — API", () => {
  test("createGutterDecorators returns 4 gutter properties and a dispose function", () => {
    const gutters = createGutterDecorators(stubContext);
    assert.strictEqual(typeof gutters.errorGutter, "object");
    assert.strictEqual(typeof gutters.warnGutter, "object");
    assert.strictEqual(typeof gutters.infoGutter, "object");
    assert.strictEqual(typeof gutters.hintGutter, "object");
    assert.strictEqual(typeof gutters.dispose, "function");
    gutters.dispose();
  });

  test("all 4 gutters have a dispose method (are TextEditorDecorationType instances)", () => {
    const gutters = createGutterDecorators(stubContext);
    assert.strictEqual(typeof gutters.errorGutter.dispose, "function");
    assert.strictEqual(typeof gutters.warnGutter.dispose, "function");
    assert.strictEqual(typeof gutters.infoGutter.dispose, "function");
    assert.strictEqual(typeof gutters.hintGutter.dispose, "function");
    gutters.dispose();
  });

  test("all 4 gutters are distinct object references", () => {
    const gutters = createGutterDecorators(stubContext);
    const decos = [gutters.errorGutter, gutters.warnGutter, gutters.infoGutter, gutters.hintGutter];
    const unique = new Set(decos);
    assert.strictEqual(unique.size, 4);
    gutters.dispose();
  });

  test("dispose() does not throw", () => {
    const gutters = createGutterDecorators(stubContext);
    assert.doesNotThrow(() => gutters.dispose());
  });

  test("dispose() called twice does not throw", () => {
    const gutters = createGutterDecorators(stubContext);
    assert.doesNotThrow(() => {
      gutters.dispose();
      gutters.dispose();
    });
  });
});
