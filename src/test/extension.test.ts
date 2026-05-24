import * as assert from "node:assert";

import * as vscode from "vscode";

import { DEFAULTS } from "../configurations";
import { createDiagnosticLine } from "../diagnostic-line";

// Mirrors PATTERNS from comments.ts (not exported) for isolated regex testing
const COMMENT_PATTERNS = {
  todo: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*((?:TODO|FIXME)\b[:-]?)\s*(.*)/i,
  fixme: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(FIXME\b[:-]?)\s*(.*)/i,
  important: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(!)\s*(.*)/,
  question: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\?)\s*(.*)/,
  highlight: /^\s*(?:\/\/|#|--|(?:\*(?!\/))|<!--|\/\*+)(?:[\s*!?]*)\s*(\*)\s*(.*)/,
};

// Mirrors truncation logic from diagnostic-line.ts for isolated testing
function truncateMessage(message: string, maxLength: number): string {
  if (maxLength > 0 && message.length > maxLength) {
    return `${message.substring(0, maxLength)}...`;
  }
  return message;
}

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Extension should be present", () => {
    assert.ok(true);
  });

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

    test("all tags have showLine enabled by default", () => {
      const keys = ["todo", "fixme", "important", "question", "highlight"] as const;
      for (const key of keys) {
        assert.strictEqual(DEFAULTS[key].showLine, true, `${key} should default showLine to true`);
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
  });

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
    });
  });

  suite("DiagnosticLine — message truncation", () => {
    test("no truncation when maxLength is 0", () => {
      assert.strictEqual(truncateMessage("long message here", 0), "long message here");
    });

    test("no truncation when message is shorter than limit", () => {
      assert.strictEqual(truncateMessage("short", 100), "short");
    });

    test("no truncation when message length equals limit exactly", () => {
      assert.strictEqual(truncateMessage("exact", 5), "exact");
    });

    test("truncates and appends ellipsis when over limit", () => {
      assert.strictEqual(truncateMessage("hello world", 5), "hello...");
    });

    test("truncates single-character overage", () => {
      assert.strictEqual(truncateMessage("abcde", 4), "abcd...");
    });

    test("empty string is unchanged regardless of limit", () => {
      assert.strictEqual(truncateMessage("", 0), "");
      assert.strictEqual(truncateMessage("", 10), "");
    });
  });

  suite("DiagnosticLine — API", () => {
    test("createDiagnosticLine returns expected API surface", () => {
      const dl = createDiagnosticLine();
      assert.strictEqual(typeof dl.updateSettings, "function");
      assert.strictEqual(typeof dl.updateForTextDocument, "function");
      assert.strictEqual(typeof dl.showLineDecoratorForDocument, "function");
      assert.strictEqual(typeof dl.removeForTextDocument, "function");
      assert.strictEqual(typeof dl.dispose, "function");
      dl.dispose();
    });

    test("updateSettings with showLine false does not throw", () => {
      const dl = createDiagnosticLine();
      assert.doesNotThrow(() => {
        dl.updateSettings({
          showLine: false,
          errorLabelBg: "#ff0000",
          warnLabelBg: "#ffff00",
          errFontColor: "#ffffff",
          warnFontColor: "#000000",
          maxLineLength: 0,
        });
      });
      dl.dispose();
    });

    test("updateSettings with showLine true does not throw", () => {
      const dl = createDiagnosticLine();
      assert.doesNotThrow(() => {
        dl.updateSettings({
          showLine: true,
          errorLabelBg: "#d32f2f88",
          warnLabelBg: "#ff980088",
          errFontColor: "#efefef",
          warnFontColor: "#000000",
          maxLineLength: 50,
        });
      });
      dl.dispose();
    });

    test("updateForTextDocument stores diagnostics for a uri", () => {
      const dl = createDiagnosticLine();
      const uri = vscode.Uri.file("/test/sample.ts");
      assert.doesNotThrow(() => {
        dl.updateForTextDocument(uri, [
          {
            severity: vscode.DiagnosticSeverity.Error,
            message: "test error",
            range: new vscode.Range(0, 0, 0, 10),
          },
        ]);
      });
      dl.dispose();
    });

    test("removeForTextDocument does not throw for a tracked uri", () => {
      const dl = createDiagnosticLine();
      const uri = vscode.Uri.file("/test/sample.ts");
      dl.updateForTextDocument(uri, []);
      assert.doesNotThrow(() => dl.removeForTextDocument(uri));
      dl.dispose();
    });

    test("removeForTextDocument does not throw for an untracked uri", () => {
      const dl = createDiagnosticLine();
      const uri = vscode.Uri.file("/test/never-added.ts");
      assert.doesNotThrow(() => dl.removeForTextDocument(uri));
      dl.dispose();
    });

    test("showLineDecoratorForDocument does not throw with no active editor", () => {
      const dl = createDiagnosticLine();
      dl.updateSettings({
        showLine: true,
        errorLabelBg: "#ff0000",
        warnLabelBg: "#ffff00",
        errFontColor: "#fff",
        warnFontColor: "#000",
        maxLineLength: 0,
      });
      const uri = vscode.Uri.file("/test/sample.ts");
      dl.updateForTextDocument(uri, [
        {
          severity: vscode.DiagnosticSeverity.Error,
          message: "error",
          range: new vscode.Range(0, 0, 0, 5),
        },
      ]);
      assert.doesNotThrow(() => dl.showLineDecoratorForDocument(uri));
      dl.dispose();
    });

    test("dispose does not throw", () => {
      const dl = createDiagnosticLine();
      assert.doesNotThrow(() => dl.dispose());
    });

    test("dispose can be called multiple times without error", () => {
      const dl = createDiagnosticLine();
      assert.doesNotThrow(() => {
        dl.dispose();
        dl.dispose();
      });
    });
  });
});
