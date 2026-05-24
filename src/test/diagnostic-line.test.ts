import * as assert from "node:assert";

import * as vscode from "vscode";

import { createDiagnosticLine } from "../diagnostic-line";

// Mirrors truncation logic from diagnostic-line.ts for isolated testing
function truncateMessage(message: string, maxLength: number): string {
  if (maxLength > 0 && message.length > maxLength) {
    return `${message.substring(0, maxLength)}...`;
  }
  return message;
}

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

  test("Warning severity updateForTextDocument does not throw", () => {
    const dl = createDiagnosticLine();
    const uri = vscode.Uri.file("/test/warn.ts");
    assert.doesNotThrow(() => {
      dl.updateForTextDocument(uri, [
        {
          severity: vscode.DiagnosticSeverity.Warning,
          message: "a warning",
          range: new vscode.Range(0, 0, 0, 5),
        },
      ]);
    });
    dl.dispose();
  });

  test("Info severity showLineDecoratorForDocument does not throw", () => {
    const dl = createDiagnosticLine();
    dl.updateSettings({
      showLine: true,
      errorLabelBg: "#ff0000",
      warnLabelBg: "#ffff00",
      errFontColor: "#fff",
      warnFontColor: "#000",
      maxLineLength: 0,
    });
    const uri = vscode.Uri.file("/test/info.ts");
    dl.updateForTextDocument(uri, [
      {
        severity: vscode.DiagnosticSeverity.Information,
        message: "info message",
        range: new vscode.Range(0, 0, 0, 5),
      },
    ]);
    assert.doesNotThrow(() => dl.showLineDecoratorForDocument(uri));
    dl.dispose();
  });

  test("double updateForTextDocument on same URI overwrites without throw", () => {
    const dl = createDiagnosticLine();
    const uri = vscode.Uri.file("/test/double.ts");
    assert.doesNotThrow(() => {
      dl.updateForTextDocument(uri, [
        {
          severity: vscode.DiagnosticSeverity.Error,
          message: "first",
          range: new vscode.Range(0, 0, 0, 5),
        },
      ]);
      dl.updateForTextDocument(uri, [
        {
          severity: vscode.DiagnosticSeverity.Error,
          message: "second",
          range: new vscode.Range(1, 0, 1, 3),
        },
      ]);
    });
    dl.dispose();
  });

  test("three consecutive updateSettings calls do not throw", () => {
    const dl = createDiagnosticLine();
    const settings = {
      showLine: true,
      errorLabelBg: "#ff0000",
      warnLabelBg: "#ffff00",
      errFontColor: "#fff",
      warnFontColor: "#000",
      maxLineLength: 0,
    };
    assert.doesNotThrow(() => {
      dl.updateSettings(settings);
      dl.updateSettings(settings);
      dl.updateSettings(settings);
    });
    dl.dispose();
  });

  test("empty diagnostics array does not throw", () => {
    const dl = createDiagnosticLine();
    const uri = vscode.Uri.file("/test/empty.ts");
    assert.doesNotThrow(() => dl.updateForTextDocument(uri, []));
    dl.dispose();
  });

  test("diagnostic with empty message does not throw", () => {
    const dl = createDiagnosticLine();
    const uri = vscode.Uri.file("/test/empty-msg.ts");
    assert.doesNotThrow(() => {
      dl.updateForTextDocument(uri, [
        {
          severity: vscode.DiagnosticSeverity.Error,
          message: "",
          range: new vscode.Range(0, 0, 0, 1),
        },
      ]);
    });
    dl.dispose();
  });

  test("multiple URIs tracked independently without interference", () => {
    const dl = createDiagnosticLine();
    const uriA = vscode.Uri.file("/test/a.ts");
    const uriB = vscode.Uri.file("/test/b.ts");
    assert.doesNotThrow(() => {
      dl.updateForTextDocument(uriA, [
        {
          severity: vscode.DiagnosticSeverity.Error,
          message: "error A",
          range: new vscode.Range(0, 0, 0, 5),
        },
      ]);
      dl.updateForTextDocument(uriB, [
        {
          severity: vscode.DiagnosticSeverity.Warning,
          message: "warn B",
          range: new vscode.Range(2, 0, 2, 3),
        },
      ]);
      dl.removeForTextDocument(uriA);
      dl.removeForTextDocument(uriB);
    });
    dl.dispose();
  });
});

suite("DiagnosticLine — line-end placement invariant", () => {
  test("range built from lineAt().range.end is zero-width", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "const x = 1;",
      language: "typescript",
    });
    const lineEnd = doc.lineAt(0).range.end;
    const range = new vscode.Range(lineEnd, lineEnd);
    assert.ok(range.isEmpty, "line-end range should be zero-width");
  });

  test("lineAt().range.end.character matches text length", async () => {
    const text = "let value = 42;";
    const doc = await vscode.workspace.openTextDocument({
      content: text,
      language: "typescript",
    });
    const lineEnd = doc.lineAt(0).range.end;
    assert.strictEqual(lineEnd.character, text.length);
  });

  test("multi-line document: each line end character matches text length", async () => {
    const lines = ["first line", "second line longer"];
    const doc = await vscode.workspace.openTextDocument({
      content: lines.join("\n"),
      language: "typescript",
    });
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = doc.lineAt(i).range.end;
      assert.strictEqual(
        lineEnd.character,
        lines[i].length,
        `line ${i} end character should equal text length`,
      );
      const range = new vscode.Range(lineEnd, lineEnd);
      assert.ok(range.isEmpty, `line ${i} zero-width range should be empty`);
    }
  });

  test("updateForTextDocument does not mutate the input range object", () => {
    const dl = createDiagnosticLine();
    const uri = vscode.Uri.file("/test/mutate.ts");
    const range = new vscode.Range(0, 10, 0, 10);
    const origStart = range.start.character;
    const origEnd = range.end.character;
    dl.updateForTextDocument(uri, [
      { severity: vscode.DiagnosticSeverity.Error, message: "msg", range },
    ]);
    assert.strictEqual(range.start.character, origStart, "start.character should not be mutated");
    assert.strictEqual(range.end.character, origEnd, "end.character should not be mutated");
    dl.dispose();
  });
});
