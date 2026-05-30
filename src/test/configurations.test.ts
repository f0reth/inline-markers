import * as assert from "node:assert";

import { isWordTag } from "../comment-scanner";
import { DEFAULT_EXCLUDE, DEFAULT_TAGS } from "../configurations";

suite("Configurations — DEFAULT_TAGS", () => {
  test("default tags and colors match the documented set, in priority order", () => {
    assert.deepStrictEqual(
      DEFAULT_TAGS.map((t) => [t.tag, t.color]),
      [
        ["TODO", "#FF8C00"],
        ["FIXME", "#FFB6C1"],
        ["!", "#FF2D00"],
        ["?", "#3498DB"],
        ["*", "#98C379"],
      ],
    );
  });

  test("has exactly 5 tags", () => {
    assert.strictEqual(DEFAULT_TAGS.length, 5);
  });

  test("all colors are hex format", () => {
    const hexRe = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    for (const t of DEFAULT_TAGS) {
      assert.ok(hexRe.test(t.color), `${t.tag} color should be hex format`);
    }
  });

  test("tag tokens are unique", () => {
    const tokens = DEFAULT_TAGS.map((t) => t.tag);
    assert.strictEqual(new Set(tokens).size, tokens.length);
  });

  test("style flags are undefined by default (decoration falls back to plain color)", () => {
    for (const t of DEFAULT_TAGS) {
      assert.strictEqual(t.bold, undefined);
      assert.strictEqual(t.italic, undefined);
      assert.strictEqual(t.strikethrough, undefined);
      assert.strictEqual(t.underline, undefined);
    }
  });

  test("TODO and FIXME are word tags; !, ?, * are symbol tags", () => {
    assert.strictEqual(isWordTag("TODO"), true);
    assert.strictEqual(isWordTag("FIXME"), true);
    assert.strictEqual(isWordTag("!"), false);
    assert.strictEqual(isWordTag("?"), false);
    assert.strictEqual(isWordTag("*"), false);
  });
});

suite("Configurations — DEFAULT_EXCLUDE", () => {
  test("excludes markdown by default", () => {
    assert.deepStrictEqual(DEFAULT_EXCLUDE, ["**/*.md", "**/*.mdx"]);
  });
});
