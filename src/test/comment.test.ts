import * as assert from "node:assert";

// Mirrors PATTERNS from comments.ts (not exported) for isolated regex testing
const COMMENT_PATTERNS = {
  todo: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*((?:TODO|FIXME)\b[:-]?)\s*(.*)/i,
  fixme: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(FIXME\b[:-]?)\s*(.*)/i,
  important: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(!)(?=\s|$)\s*(.*)/,
  question: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\?)(?=\s|$)\s*(.*)/,
  highlight: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\*)(?=\s|$)\s*(.*)/,
};

suite("Comment Patterns", () => {
  suite("todo", () => {
    const pat = COMMENT_PATTERNS.todo;

    test("matches // TODO:", () => {
      const m = pat.exec("// TODO: fix this");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("TODO"));
      assert.strictEqual(m[2].trim(), "fix this");
    });

    test("matches // FIXME:", () => {
      const m = pat.exec("// FIXME: broken");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("FIXME"));
    });

    test("matches # TODO (Python/Shell style)", () => {
      const m = pat.exec("# TODO: implement this");
      assert.ok(m, "should match");
    });

    test("matches /* TODO */  (block comment)", () => {
      const m = pat.exec("/* TODO: block comment */");
      assert.ok(m, "should match");
    });

    test("matches <!-- TODO --> (HTML comment)", () => {
      const m = pat.exec("<!-- TODO: html comment -->");
      assert.ok(m, "should match");
    });

    test("matches -- TODO (SQL style)", () => {
      const m = pat.exec("-- TODO: sql comment");
      assert.ok(m, "should match");
    });

    test("is case insensitive", () => {
      assert.ok(pat.exec("// todo: lowercase"), "lowercase todo should match");
      assert.ok(pat.exec("// Todo: mixed case"), "mixed case should match");
    });

    test("matches TODO without colon", () => {
      const m = pat.exec("// TODO fix this");
      assert.ok(m, "should match without colon");
    });

    test("does not match plain text without comment prefix", () => {
      assert.strictEqual(pat.exec("just a regular line"), null);
      assert.strictEqual(pat.exec("some todo in text"), null);
    });

    test("matches indented // TODO:", () => {
      assert.ok(pat.exec("    // TODO: indented"), "indented should match");
    });

    test("matches //TODO: with no space between // and keyword", () => {
      assert.ok(pat.exec("//TODO: no space"), "no-space variant should match");
    });

    test("matches // TODO- (dash separator)", () => {
      assert.ok(pat.exec("// TODO- message"), "dash separator should match");
    });

    test("matches // TODO (keyword only, no separator)", () => {
      assert.ok(pat.exec("// TODO"), "keyword-only should match");
    });

    test("matches // TODO: with empty message (m[2] is empty string)", () => {
      const m = pat.exec("// TODO:");
      assert.ok(m, "should match");
      assert.strictEqual(m[2], "");
    });

    test("matches block comment middle line * TODO:", () => {
      assert.ok(pat.exec("   * TODO: in block"), "block comment middle line should match");
    });

    test("does not match URL-like line without comment prefix", () => {
      assert.strictEqual(pat.exec("https://example.com"), null);
    });
  });

  suite("fixme", () => {
    const pat = COMMENT_PATTERNS.fixme;

    test("matches // FIXME:", () => {
      const m = pat.exec("// FIXME: this is broken");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("FIXME"));
      assert.strictEqual(m[2].trim(), "this is broken");
    });

    test("matches # FIXME (Python style)", () => {
      const m = pat.exec("# FIXME: python comment");
      assert.ok(m, "should match");
    });

    test("does not match TODO-only lines", () => {
      assert.strictEqual(pat.exec("// TODO: not a fixme"), null);
    });

    test("does not match plain text", () => {
      assert.strictEqual(pat.exec("no fixme here"), null);
    });

    test("matches // FIXME- (dash separator)", () => {
      assert.ok(pat.exec("// FIXME- broken"), "dash separator should match");
    });

    test("matches // FIXME (keyword only)", () => {
      assert.ok(pat.exec("// FIXME"), "keyword-only should match");
    });

    test("matches //FIXME: with no space", () => {
      assert.ok(pat.exec("//FIXME: no space"), "no-space variant should match");
    });

    test("matches <!-- FIXME: --> (HTML comment)", () => {
      assert.ok(pat.exec("<!-- FIXME: html -->"), "HTML comment should match");
    });

    test("matches -- FIXME: (SQL comment)", () => {
      assert.ok(pat.exec("-- FIXME: sql"), "SQL comment should match");
    });
  });

  suite("important (!)", () => {
    const pat = COMMENT_PATTERNS.important;

    test("matches // ! with message", () => {
      const m = pat.exec("// ! critical section");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "!");
      assert.strictEqual(m[2].trim(), "critical section");
    });

    test("matches // ! with no message", () => {
      const m = pat.exec("// !");
      assert.ok(m, "should match with no message");
      assert.strictEqual(m[1], "!");
    });

    test("matches # ! (Python style)", () => {
      assert.ok(pat.exec("# ! important"), "should match");
    });

    test("does not match plain text", () => {
      assert.strictEqual(pat.exec("regular line"), null);
      assert.strictEqual(pat.exec("important note"), null);
    });

    test("matches <!-- ! --> (HTML comment)", () => {
      assert.ok(pat.exec("<!-- ! html important -->"), "HTML comment should match");
    });

    test("matches -- ! (SQL comment)", () => {
      assert.ok(pat.exec("-- ! sql"), "SQL comment should match");
    });

    test("matches /* ! */ (block comment)", () => {
      assert.ok(pat.exec("/* ! block */"), "block comment should match");
    });

    test("matches indented // !", () => {
      assert.ok(pat.exec("    // ! indented"), "indented should match");
    });

    test("matches // !! (double exclamation mark)", () => {
      assert.ok(pat.exec("// !!"), "double exclamation should match");
    });

    test("matches //! (no space, m[1]=! m[2]=empty)", () => {
      const m = pat.exec("//!");
      assert.ok(m, "no-space variant should match");
      assert.strictEqual(m[1], "!");
      assert.strictEqual(m[2], "");
    });

    test("does not match // !important (CSS false positive)", () => {
      assert.strictEqual(pat.exec("// !important"), null);
    });

    test("does not match # !something (tag immediately followed by word)", () => {
      assert.strictEqual(pat.exec("# !something"), null);
    });
  });

  suite("question (?)", () => {
    const pat = COMMENT_PATTERNS.question;

    test("matches // ? with message", () => {
      const m = pat.exec("// ? is this right?");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "?");
      assert.strictEqual(m[2].trim(), "is this right?");
    });

    test("matches # ? (Python style)", () => {
      assert.ok(pat.exec("# ? python question"), "should match");
    });

    test("does not match plain text", () => {
      assert.strictEqual(pat.exec("no comment here"), null);
    });

    test("matches <!-- ? --> (HTML comment)", () => {
      assert.ok(pat.exec("<!-- ? question -->"), "HTML comment should match");
    });

    test("matches -- ? (SQL comment)", () => {
      assert.ok(pat.exec("-- ? sql"), "SQL comment should match");
    });

    test("matches /* ? */ (block comment)", () => {
      assert.ok(pat.exec("/* ? block */"), "block comment should match");
    });

    test("matches indented // ?", () => {
      assert.ok(pat.exec("    // ? indented"), "indented should match");
    });

    test("matches // ?? (double question mark)", () => {
      assert.ok(pat.exec("// ??"), "double question mark should match");
    });

    test("does not match // ?something (tag immediately followed by word)", () => {
      assert.strictEqual(pat.exec("// ?something"), null);
    });
  });

  suite("highlight (*)", () => {
    const pat = COMMENT_PATTERNS.highlight;

    test("matches // * with message", () => {
      const m = pat.exec("// * important highlight");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "*");
      assert.strictEqual(m[2].trim(), "important highlight");
    });

    test("matches # * (Python style)", () => {
      assert.ok(pat.exec("# * highlight"), "should match");
    });

    test("does not match plain text without comment prefix", () => {
      assert.strictEqual(pat.exec("no highlight here"), null);
    });

    test("matches <!-- * --> (HTML comment)", () => {
      assert.ok(pat.exec("<!-- * html -->"), "HTML comment should match");
    });

    test("matches -- * (SQL comment)", () => {
      assert.ok(pat.exec("-- * sql"), "SQL comment should match");
    });

    test("matches /* * */ (block comment)", () => {
      assert.ok(pat.exec("/* * block */"), "block comment should match");
    });

    test("matches indented // *", () => {
      assert.ok(pat.exec("    // * indented"), "indented should match");
    });

    test("matches // ** (double star)", () => {
      assert.ok(pat.exec("// **"), "double star should match");
    });

    test("does not match markdown list line '* item'", () => {
      assert.strictEqual(pat.exec("* item"), null);
    });

    test("does not match block comment close '*/'", () => {
      assert.strictEqual(pat.exec("*/"), null);
    });

    test("does not match glob pattern '**/*.ts'", () => {
      assert.strictEqual(pat.exec("**/*.ts"), null);
    });

    test("does not match '# *.ts' (glob in hash comment)", () => {
      assert.strictEqual(pat.exec("# *.ts"), null);
    });

    test("does not match '**/.vscode-test.*'", () => {
      assert.strictEqual(pat.exec("**/.vscode-test.*"), null);
    });

    test("does not match '**/eslint.config.mjs'", () => {
      assert.strictEqual(pat.exec("**/eslint.config.mjs"), null);
    });
  });
});
