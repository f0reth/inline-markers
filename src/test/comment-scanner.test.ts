import * as assert from "node:assert";

import {
  compileMatcher,
  globToRegExp,
  isExcluded,
  isWordTag,
  scanText,
  ScanMatch,
} from "../comment-scanner";
import { TagConfig } from "../types";

const TAGS: TagConfig[] = [
  { tag: "TODO", color: "#FF8C00" },
  { tag: "FIXME", color: "#FFB6C1" },
  { tag: "!", color: "#FF2D00" },
  { tag: "?", color: "#3498DB" },
  { tag: "*", color: "#98C379" },
];

const matcher = compileMatcher(TAGS);

function scan(text: string, multiline = true): ScanMatch[] {
  return scanText(text, matcher, multiline);
}

suite("comment-scanner — isWordTag", () => {
  test("word tags begin with an alphanumeric character", () => {
    assert.strictEqual(isWordTag("TODO"), true);
    assert.strictEqual(isWordTag("BUG"), true);
    assert.strictEqual(isWordTag("0xCAFE"), true);
  });

  test("symbol tags do not", () => {
    assert.strictEqual(isWordTag("!"), false);
    assert.strictEqual(isWordTag("?"), false);
    assert.strictEqual(isWordTag("*"), false);
  });
});

suite("comment-scanner — single-line scanning", () => {
  test("// TODO: fix this → todo (index 0), message stripped", () => {
    const r = scan("// TODO: fix this");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].tagIndex, 0);
    assert.strictEqual(r[0].message, "fix this");
  });

  test("// FIXME: broken → fixme (index 1)", () => {
    const r = scan("// FIXME: broken");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].tagIndex, 1);
  });

  test("symbol tags ! ? * map to indices 2/3/4", () => {
    assert.strictEqual(scan("// ! important")[0].tagIndex, 2);
    assert.strictEqual(scan("// ? wondering")[0].tagIndex, 3);
    assert.strictEqual(scan("// * highlight")[0].tagIndex, 4);
  });

  test("supports #, --, <!-- and /* delimiters", () => {
    assert.strictEqual(scan("# TODO: py").length, 1);
    assert.strictEqual(scan("-- TODO: sql").length, 1);
    assert.strictEqual(scan("<!-- TODO: html -->").length, 1);
    assert.strictEqual(scan("/* TODO: block */").length, 1);
  });

  test("is case insensitive", () => {
    assert.strictEqual(scan("// todo: lower")[0].tagIndex, 0);
  });

  test("inline comment after code is detected", () => {
    const r = scan("const x = 1; // TODO: fix");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].tagIndex, 0);
    assert.strictEqual(r[0].range.startLine, 0);
  });

  test("plain text without a comment prefix is ignored", () => {
    assert.strictEqual(scan("just a regular line").length, 0);
    assert.strictEqual(scan("some todo in text").length, 0);
  });

  test("trailing */ and --> are stripped from the message", () => {
    assert.strictEqual(scan("/* TODO: fix */")[0].message, "fix");
    assert.strictEqual(scan("<!-- TODO: html -->")[0].message, "html");
  });

  test("empty message falls back to the tag token", () => {
    assert.strictEqual(scan("// TODO")[0].message, "TODO");
    assert.strictEqual(scan("// !")[0].message, "!");
  });

  test("! at end of line (before newline) is matched", () => {
    const r = scan("// !\nnext line");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].tagIndex, 2);
  });

  test("symbol tag immediately followed by a word is not matched", () => {
    assert.strictEqual(scan("// !important").length, 0);
    assert.strictEqual(scan("// ?something").length, 0);
  });

  test("glob-like lines do not match the * tag", () => {
    assert.strictEqual(scan("**/*.ts").length, 0);
    assert.strictEqual(scan("* item").length, 0);
  });
});

suite("comment-scanner — offsets / line index", () => {
  test("range.startLine reflects the line of the match", () => {
    const r = scan("const x = 1;\n// TODO: fix this");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].range.startLine, 1);
    assert.strictEqual(r[0].range.startCharacter, 0);
  });

  test("tagRange covers exactly the tag token", () => {
    const r = scan("// TODO: fix");
    // "// " = 3 chars, tag "TODO:" spans 5 chars
    assert.strictEqual(r[0].tagRange.startCharacter, 3);
    assert.strictEqual(r[0].tagRange.endCharacter, 8);
  });

  test("handles \\r\\n line endings", () => {
    const r = scan("a\r\n// TODO: x");
    assert.strictEqual(r[0].range.startLine, 1);
    assert.strictEqual(r[0].range.startCharacter, 0);
  });
});

suite("comment-scanner — block comments", () => {
  test("tag inside /* */ block is detected", () => {
    const r = scan("/*\n * TODO: implement\n */");
    assert.ok(r.some((x) => x.tagIndex === 0 && x.message === "implement"));
  });

  test("tag inside /** */ JSDoc block is detected", () => {
    const r = scan("/**\n * FIXME: document this\n */");
    assert.ok(r.some((x) => x.tagIndex === 1));
  });

  test("multiline=false ignores block-only tags", () => {
    assert.strictEqual(scan("/*\n * TODO: inside\n */", false).length, 0);
  });

  test("tag on a block opening line is reported once (not double-counted)", () => {
    const r = scan("/* TODO: open\n * more\n */");
    const todos = r.filter((x) => x.tagIndex === 0);
    assert.strictEqual(todos.length, 1);
  });

  test("block start-line tag absolute offset matches single-line scanning", () => {
    const text = "/*\n * TODO: x\n */";
    const r = scan(text);
    const todo = r.find((x) => x.tagIndex === 0)!;
    // "T" of TODO sits at offset 6: /,*,\n,space,*,space,T
    assert.strictEqual(todo.tagRange.startLine, 1);
    assert.strictEqual(todo.tagRange.startCharacter, 3);
  });
});

suite("comment-scanner — empty / multiple", () => {
  test("empty text → no matches", () => {
    assert.deepStrictEqual(scan(""), []);
  });

  test("multiple inline comments on separate lines", () => {
    const r = scan("const a=1; // TODO: a\nconst b=2; // FIXME: b\nconst c=3; // ! c");
    assert.strictEqual(r.length, 3);
    assert.deepStrictEqual(
      r.map((x) => x.tagIndex),
      [0, 1, 2],
    );
  });
});

suite("comment-scanner — custom tags", () => {
  test("user-defined tags respect array order and word/symbol classification", () => {
    const custom = compileMatcher([
      { tag: "NOTE", color: "#fff" },
      { tag: "@", color: "#000" },
    ]);
    const r = scanText("// NOTE: hello\n// @ marker", custom, true);
    assert.strictEqual(r.length, 2);
    assert.strictEqual(r[0].tagIndex, 0);
    assert.strictEqual(r[1].tagIndex, 1);
    assert.strictEqual(custom.isWord[0], true);
    assert.strictEqual(custom.isWord[1], false);
  });

  test("regex-special characters in a tag are escaped", () => {
    const custom = compileMatcher([{ tag: "[x]", color: "#000" }]);
    assert.strictEqual(scanText("// [x] note", custom, true).length, 1);
    assert.strictEqual(scanText("// y note", custom, true).length, 0);
  });
});

suite("comment-scanner — globToRegExp", () => {
  test("**/*.md matches files at any depth", () => {
    const re = globToRegExp("**/*.md");
    assert.ok(re.test("readme.md"));
    assert.ok(re.test("docs/readme.md"));
    assert.ok(re.test("/c:/proj/docs/a.md"));
    assert.ok(!re.test("readme.txt"));
  });

  test("* stays within a single path segment", () => {
    const re = globToRegExp("src/*.ts");
    assert.ok(re.test("src/a.ts"));
    assert.ok(!re.test("src/sub/a.ts"));
  });

  test("? matches a single non-slash character", () => {
    const re = globToRegExp("a?c");
    assert.ok(re.test("abc"));
    assert.ok(!re.test("ac"));
    assert.ok(!re.test("a/c"));
  });

  test("{a,b} alternation", () => {
    const re = globToRegExp("**/*.{md,mdx}");
    assert.ok(re.test("a.md"));
    assert.ok(re.test("docs/a.mdx"));
    assert.ok(!re.test("a.ts"));
  });

  test("regex special characters are treated literally", () => {
    const re = globToRegExp("a.b");
    assert.ok(re.test("a.b"));
    assert.ok(!re.test("axb"));
  });

  test("backslash paths are normalized to forward slashes", () => {
    const re = globToRegExp("**/*.md");
    assert.ok(re.test("C:\\proj\\a.md"));
  });
});

suite("comment-scanner — isExcluded", () => {
  test("returns true when any glob matches", () => {
    const res = ["**/*.md", "**/*.mdx"].map(globToRegExp);
    assert.strictEqual(isExcluded("/p/readme.md", res), true);
    assert.strictEqual(isExcluded("/p/a.mdx", res), true);
    assert.strictEqual(isExcluded("/p/a.ts", res), false);
  });

  test("empty glob list excludes nothing", () => {
    assert.strictEqual(isExcluded("/p/a.md", []), false);
  });
});
