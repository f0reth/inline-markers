import * as assert from "node:assert";

import { BLOCK_INNER_PATTERNS, SINGLE_LINE_PATTERNS, TRAIL_RE } from "../comments";

suite("TRAIL_RE — trailing block comment closer stripping", () => {
  test("strips trailing */", () => {
    assert.strictEqual("block comment */".replace(TRAIL_RE, "").trim(), "block comment");
  });
  test("strips trailing */ with whitespace", () => {
    assert.strictEqual("message  */  ".replace(TRAIL_RE, "").trim(), "message");
  });
  test("strips trailing -->", () => {
    assert.strictEqual("html comment -->".replace(TRAIL_RE, "").trim(), "html comment");
  });
  test("does not strip plain message (no trailing closer)", () => {
    assert.strictEqual("plain message".replace(TRAIL_RE, ""), "plain message");
  });
  test("strips trailing **/ (double star)", () => {
    assert.ok(!"message **/".replace(TRAIL_RE, "").includes("**/"));
  });
});

suite("SINGLE_LINE_PATTERNS", () => {
  suite("todo", () => {
    const pat = SINGLE_LINE_PATTERNS.todo;

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

    test("does not match URL-like line without comment prefix", () => {
      assert.strictEqual(pat.exec("https://example.com"), null);
    });

    test("matches inline comment: const x = 1; // TODO: fix", () => {
      const m = pat.exec("const x = 1; // TODO: fix");
      assert.ok(m, "inline comment should match");
      assert.ok(m[1].toUpperCase().startsWith("TODO"));
      assert.strictEqual(m[2].trim(), "fix");
    });
  });

  suite("fixme", () => {
    const pat = SINGLE_LINE_PATTERNS.fixme;

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

    test("matches inline comment: return x; // FIXME: off-by-one", () => {
      const m = pat.exec("return x; // FIXME: off-by-one");
      assert.ok(m, "inline FIXME should match");
    });
  });

  suite("important (!)", () => {
    const pat = SINGLE_LINE_PATTERNS.important;

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
    const pat = SINGLE_LINE_PATTERNS.question;

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

  suite("todo — ! prefix absorption", () => {
    test("todo pattern matches '// ! TODO: msg' ([ \\t*!?]* absorbs ! prefix)", () => {
      const m = SINGLE_LINE_PATTERNS.todo.exec("// ! TODO: priority check");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("TODO"));
    });
  });

  suite("newline-crossing prevention", () => {
    test("todo: match does not span into next line after '// TODO'", () => {
      const text = "// TODO\nnext line content";
      const m = SINGLE_LINE_PATTERNS.todo.exec(text);
      assert.ok(m, "should match TODO on first line");
      // m[0] must not contain a newline
      assert.ok(!m[0].includes("\n"), "match should not cross newline");
    });

    test("todo: match range ends at line boundary for '// TODO: fix'", () => {
      const text = "// TODO: fix\nnext line";
      const m = SINGLE_LINE_PATTERNS.todo.exec(text);
      assert.ok(m, "should match");
      assert.ok(!m[0].includes("\n"), "match should not cross newline");
      assert.strictEqual(m[2].trim(), "fix");
    });

    test("important: '/* ' first line does not match next-line content as decoration", () => {
      // Block comment open line alone — SINGLE_LINE_PATTERNS should not match
      // because there is no tag character on this line
      const firstLine = "/*";
      assert.strictEqual(SINGLE_LINE_PATTERNS.important.exec(firstLine), null);
      assert.strictEqual(SINGLE_LINE_PATTERNS.todo.exec(firstLine), null);
    });

    test("important: match does not cross newline after '// !'", () => {
      const text = "// !\nnext line";
      const m = SINGLE_LINE_PATTERNS.important.exec(text);
      assert.ok(m, "should match");
      assert.ok(!m[0].includes("\n"), "match should not cross newline");
    });

    test("highlight: match does not cross newline after '// *'", () => {
      const text = "// * note\nnext line";
      const m = SINGLE_LINE_PATTERNS.highlight.exec(text);
      assert.ok(m, "should match");
      assert.ok(!m[0].includes("\n"), "match should not cross newline");
    });
  });

  suite("highlight (*)", () => {
    const pat = SINGLE_LINE_PATTERNS.highlight;

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

suite("BLOCK_INNER_PATTERNS", () => {
  suite("todo", () => {
    const pat = BLOCK_INNER_PATTERNS.todo;

    test("matches block comment middle line * TODO:", () => {
      const m = pat.exec("   * TODO: in block");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("TODO"));
      assert.strictEqual(m[2].trim(), "in block");
    });

    test("matches line with leading whitespace only", () => {
      assert.ok(pat.exec("   TODO: no star prefix"), "whitespace-only prefix should match");
    });

    test("matches FIXME via todo pattern", () => {
      assert.ok(pat.exec(" * FIXME: captured by todo pattern"), "FIXME should match todo");
    });

    test("is case insensitive", () => {
      assert.ok(pat.exec(" * todo: lowercase"), "lowercase should match");
    });
  });

  suite("fixme", () => {
    const pat = BLOCK_INNER_PATTERNS.fixme;

    test("matches * FIXME: line", () => {
      const m = pat.exec(" * FIXME: broken here");
      assert.ok(m, "should match");
      assert.ok(m[1].toUpperCase().startsWith("FIXME"));
    });

    test("does not match TODO-only line", () => {
      assert.strictEqual(pat.exec(" * TODO: not fixme"), null);
    });

    test("is case insensitive (lowercase fixme:)", () => {
      assert.ok(pat.exec(" * fixme: lowercase"), "lowercase fixme should match");
    });
  });

  suite("important (!)", () => {
    const pat = BLOCK_INNER_PATTERNS.important;

    test("matches * ! line", () => {
      const m = pat.exec(" * ! critical");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "!");
    });

    test("does not match * !word (no space after !)", () => {
      assert.strictEqual(pat.exec(" * !word"), null);
    });
  });

  suite("highlight (*)", () => {
    const pat = BLOCK_INNER_PATTERNS.highlight;

    test("matches * * highlight line (star prefix + star tag)", () => {
      const m = pat.exec(" * * highlighted note");
      assert.ok(m, "should match — first * is prefix, second * is tag");
      assert.strictEqual(m[1], "*");
    });

    test("matches line with just star tag", () => {
      assert.ok(pat.exec("   * note"), "should match");
    });
  });

  suite("question (?)", () => {
    const pat = BLOCK_INNER_PATTERNS.question;

    test('matches " * ? is this right?"', () => {
      const m = pat.exec(" * ? is this right?");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "?");
      assert.strictEqual(m[2].trim(), "is this right?");
    });

    test('matches line with only "?"', () => {
      const m = pat.exec("   ?");
      assert.ok(m, "should match");
      assert.strictEqual(m[1], "?");
    });

    test('does not match " * ?word" (no space after ?)', () => {
      assert.strictEqual(pat.exec(" * ?word"), null);
    });

    test('does not match " * TODO: not question"', () => {
      assert.strictEqual(pat.exec(" * TODO: not question"), null);
    });

    test('matches " * ?" (tag only, no message)', () => {
      const m = pat.exec(" * ?");
      assert.ok(m, "should match with no message");
      assert.strictEqual(m[1], "?");
    });
  });
});
