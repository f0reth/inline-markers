import * as assert from "node:assert";

import { createGutterDecorators } from "../gutter";

const stubContext = {
  asAbsolutePath: (p: string) => p,
};

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

  test("createGutterDecorators calls asAbsolutePath with the 4 expected SVG icon paths", () => {
    const calls: string[] = [];
    const spyContext = {
      asAbsolutePath: (p: string) => {
        calls.push(p);
        return p;
      },
    };
    const gutters = createGutterDecorators(spyContext);
    assert.ok(
      calls.some((p) => p.includes("error.svg")),
      "error.svg should be resolved",
    );
    assert.ok(
      calls.some((p) => p.includes("warn.svg")),
      "warn.svg should be resolved",
    );
    assert.ok(
      calls.some((p) => p.includes("info.svg")),
      "info.svg should be resolved",
    );
    assert.ok(
      calls.some((p) => p.includes("hint.svg")),
      "hint.svg should be resolved",
    );
    gutters.dispose();
  });
});
