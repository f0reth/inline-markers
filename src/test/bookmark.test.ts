import * as assert from "node:assert";

import * as vscode from "vscode";

import { applyShift, createBookmarkManager } from "../bookmark";
import { Bookmark } from "../types";

function makeContext() {
  const store = new Map<string, unknown>();
  return {
    asAbsolutePath: (p: string) => p,
    workspaceState: {
      keys: (): readonly string[] => [...store.keys()],
      get: <T>(key: string, defaultValue?: T): T => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        return (store.has(key) ? store.get(key) : defaultValue) as T;
      },
      update: (key: string, value: unknown): Thenable<void> => {
        store.set(key, value);
        return Promise.resolve();
      },
    },
  };
}

const URI_A = "file:///workspace/a.ts";
const URI_B = "file:///workspace/b.ts";

suite("BookmarkManager — toggle", () => {
  test("toggle adds a bookmark on first call", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 5);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].uri, URI_A);
    assert.strictEqual(stored[0].line, 5);
    mgr.dispose();
  });

  test("toggle removes an existing bookmark on second call", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 5);
    await mgr.toggle(URI_A, 5);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 0);
    mgr.dispose();
  });

  test("toggle on different lines creates independent bookmarks", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 3);
    await mgr.toggle(URI_A, 10);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 2);
    mgr.dispose();
  });

  test("toggle on different URIs creates independent bookmarks", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 0);
    await mgr.toggle(URI_B, 0);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 2);
    mgr.dispose();
  });

  test("toggling a bookmark in file A does not affect file B", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 1);
    await mgr.toggle(URI_B, 1);
    await mgr.toggle(URI_A, 1);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].uri, URI_B);
    mgr.dispose();
  });
});

suite("BookmarkManager — clearAll", () => {
  test("clearAll removes all bookmarks across files", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 0);
    await mgr.toggle(URI_B, 5);
    await mgr.clearAll();
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 0);
    mgr.dispose();
  });

  test("clearAll on empty store does not throw", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await assert.doesNotReject(() => mgr.clearAll());
    mgr.dispose();
  });
});

suite("BookmarkManager — clearFile", () => {
  test("clearFile removes only bookmarks for the target URI", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 1);
    await mgr.toggle(URI_A, 2);
    await mgr.toggle(URI_B, 3);
    await mgr.clearFile(URI_A);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].uri, URI_B);
    mgr.dispose();
  });
});

suite("BookmarkManager — deleteBookmark", () => {
  test("deleteBookmark removes a single bookmark", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 5);
    await mgr.toggle(URI_A, 10);
    const stored = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    await mgr.deleteBookmark(stored[0]);
    const after = ctx.workspaceState.get<Bookmark[]>("inline-markers.bookmarks", []);
    assert.strictEqual(after.length, 1);
    mgr.dispose();
  });
});

suite("BookmarkManager — getBookmarkedLines", () => {
  test("getBookmarkedLines returns Set of lines for a URI", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_A, 3);
    await mgr.toggle(URI_A, 7);
    const lines = mgr.getBookmarkedLines(vscode.Uri.parse(URI_A));
    assert.ok(lines.has(3));
    assert.ok(lines.has(7));
    assert.strictEqual(lines.size, 2);
    mgr.dispose();
  });

  test("getBookmarkedLines returns empty set for URI with no bookmarks", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    const lines = mgr.getBookmarkedLines(vscode.Uri.parse(URI_A));
    assert.strictEqual(lines.size, 0);
    mgr.dispose();
  });

  test("getBookmarkedLines excludes bookmarks from other URIs", async () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    await mgr.toggle(URI_B, 10);
    const lines = mgr.getBookmarkedLines(vscode.Uri.parse(URI_A));
    assert.strictEqual(lines.size, 0);
    mgr.dispose();
  });
});

suite("BookmarkManager — navigateNext / navigatePrevious (no active editor)", () => {
  test("navigateNext does not throw when no active editor", () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    assert.doesNotThrow(() => mgr.navigateNext());
    mgr.dispose();
  });

  test("navigatePrevious does not throw when no active editor", () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    assert.doesNotThrow(() => mgr.navigatePrevious());
    mgr.dispose();
  });
});

suite("BookmarkManager — API surface", () => {
  test("createBookmarkManager returns expected API surface", () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    assert.strictEqual(typeof mgr.toggle, "function");
    assert.strictEqual(typeof mgr.clearAll, "function");
    assert.strictEqual(typeof mgr.clearFile, "function");
    assert.strictEqual(typeof mgr.deleteBookmark, "function");
    assert.strictEqual(typeof mgr.navigateNext, "function");
    assert.strictEqual(typeof mgr.navigatePrevious, "function");
    assert.strictEqual(typeof mgr.getBookmarkedLines, "function");
    assert.strictEqual(typeof mgr.shiftBookmarks, "function");
    assert.strictEqual(typeof mgr.updateDecorations, "function");
    assert.strictEqual(typeof mgr.dispose, "function");
    assert.strictEqual(typeof mgr.getBookmarks, "function");
    mgr.dispose();
  });

  test("dispose does not throw", () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    assert.doesNotThrow(() => mgr.dispose());
  });

  test("dispose can be called twice without error", () => {
    const ctx = makeContext();
    const mgr = createBookmarkManager(ctx, () => {});
    assert.doesNotThrow(() => {
      mgr.dispose();
      mgr.dispose();
    });
  });
});

suite("applyShift — single-line insertions", () => {
  test("inserting lines above a bookmark shifts it down by delta", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 5 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 2 }, end: { line: 2 } }, text: "a\nb\nc" },
    ]);
    assert.strictEqual(result[0].line, 7);
  });

  test("inserting lines below a bookmark does not move it", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 3 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 5 }, end: { line: 5 } }, text: "a\nb" },
    ]);
    assert.strictEqual(result[0].line, 3);
  });

  test("single-line edit on the same line as a bookmark does not remove it", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 4 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 4 }, end: { line: 4 } }, text: "updated content" },
    ]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].line, 4);
  });
});

suite("applyShift — multi-line deletions", () => {
  test("deleting lines removes bookmarks in the deleted range", () => {
    const bookmarks: Bookmark[] = [
      { uri: URI_A, line: 2 },
      { uri: URI_A, line: 5 },
      { uri: URI_A, line: 8 },
    ];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 3 }, end: { line: 6 } }, text: "" },
    ]);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].line, 2);
    assert.strictEqual(result[1].line, 5);
  });

  test("bookmarks below a deletion are shifted up", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 10 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 4 }, end: { line: 7 } }, text: "" },
    ]);
    assert.strictEqual(result[0].line, 7);
  });

  test("bookmark at the start of a multi-line deletion is removed", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 3 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 3 }, end: { line: 5 } }, text: "" },
    ]);
    assert.strictEqual(result.length, 0);
  });

  test("bookmark at the end of a multi-line deletion is removed", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 5 }];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 3 }, end: { line: 5 } }, text: "" },
    ]);
    assert.strictEqual(result.length, 0);
  });
});

suite("applyShift — multiple changes processed bottom-up", () => {
  test("two insertions are applied independently without interfering", () => {
    const bookmarks: Bookmark[] = [
      { uri: URI_A, line: 2 },
      { uri: URI_A, line: 8 },
    ];
    const result = applyShift(bookmarks, [
      { range: { start: { line: 1 }, end: { line: 1 } }, text: "a\nb" },
      { range: { start: { line: 6 }, end: { line: 6 } }, text: "x\ny" },
    ]);
    assert.strictEqual(result[0].line, 3);
    assert.strictEqual(result[1].line, 10);
  });

  test("empty changes array returns bookmarks unchanged", () => {
    const bookmarks: Bookmark[] = [{ uri: URI_A, line: 5 }];
    const result = applyShift(bookmarks, []);
    assert.strictEqual(result[0].line, 5);
  });
});
