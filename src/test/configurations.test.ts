import * as assert from "node:assert";

import { DEFAULTS } from "../configurations";

suite("Configurations", () => {
  test("DEFAULTS colors are correct", () => {
    assert.strictEqual(DEFAULTS.todo.color, "#FF8C00");
    assert.strictEqual(DEFAULTS.fixme.color, "#FFB6C1");
    assert.strictEqual(DEFAULTS.important.color, "#FF2D00");
    assert.strictEqual(DEFAULTS.question.color, "#3498DB");
    assert.strictEqual(DEFAULTS.highlight.color, "#98C379");
  });

  test("all tags default to enabled", () => {
    const keys = ["todo", "fixme", "important", "question", "highlight"] as const;
    for (const key of keys) {
      assert.strictEqual(DEFAULTS[key].enabled, true, `${key} should default to enabled`);
    }
  });

  test("all tags reference an SVG gutter icon", () => {
    const keys = ["todo", "fixme", "important", "question", "highlight"] as const;
    for (const key of keys) {
      assert.ok(
        DEFAULTS[key].gutterIcon.endsWith(".svg"),
        `${key}.gutterIcon should be an SVG path`,
      );
    }
  });

  test("all tags have hex-format colors", () => {
    const hexRe = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
    const keys = ["todo", "fixme", "important", "question", "highlight"] as const;
    for (const key of keys) {
      assert.ok(hexRe.test(DEFAULTS[key].color), `${key}.color should be hex format`);
    }
  });

  test("all tags have gutterIcon starting with images/", () => {
    const keys = ["todo", "fixme", "important", "question", "highlight"] as const;
    for (const key of keys) {
      assert.ok(
        DEFAULTS[key].gutterIcon.startsWith("images/"),
        `${key}.gutterIcon should start with "images/"`,
      );
    }
  });
});
