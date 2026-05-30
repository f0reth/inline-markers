import * as assert from "node:assert";

import * as vscode from "vscode";

import {
  CommentEntry,
  MarkerFileTreeItem,
  createBookmarkItemTreeItem,
  createCommentItemTreeItem,
  createMarkerFileTreeItem,
  createMarkersTreeProvider,
  createPlaceholderTreeItem,
  createSectionTreeItem,
} from "../markers-tree";
import { Bookmark } from "../types";

type Provider = ReturnType<typeof createMarkersTreeProvider>;

function waitForRefresh(provider: Provider): Promise<void> {
  return new Promise((resolve) => {
    const d = provider.onDidChangeTreeData(() => {
      d.dispose();
      resolve();
    });
  });
}

suite("markers-tree — tree item factories", () => {
  test("SectionTreeItem: sectionId and Expanded state", () => {
    const item = createSectionTreeItem("Bookmarks", "bookmarks");
    assert.strictEqual(item.kind, "section");
    assert.strictEqual(item.sectionId, "bookmarks");
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  test("PlaceholderTreeItem: None collapsible state", () => {
    const item = createPlaceholderTreeItem("No bookmarks");
    assert.strictEqual(item.kind, "placeholder");
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
  });

  test("MarkerFileTreeItem(bookmarks/comments): contextValue", () => {
    assert.strictEqual(
      createMarkerFileTreeItem("file:///test.ts", "test.ts", "bookmarks").contextValue,
      "bookmarkFile",
    );
    assert.strictEqual(
      createMarkerFileTreeItem("file:///test.ts", "test.ts", "comments").contextValue,
      "commentFile",
    );
  });

  test("MarkerFileTreeItem: iconPath is ThemeIcon.File and command opens the file", () => {
    const item = createMarkerFileTreeItem("file:///test.ts", "test.ts", "bookmarks");
    assert.strictEqual(item.iconPath, vscode.ThemeIcon.File);
    assert.strictEqual(item.command?.command, "vscode.open");
  });

  test("BookmarkItemTreeItem: preserves bookmark, contextValue, jump command", () => {
    const bm: Bookmark = { uri: "file:///test.ts", line: 5 };
    const item = createBookmarkItemTreeItem(bm, "L6: test");
    assert.strictEqual(item.kind, "bookmarkItem");
    assert.deepStrictEqual(item.bookmark, bm);
    assert.strictEqual(item.contextValue, "bookmarkItem");
    assert.strictEqual(item.command?.command, "inline-markers.bookmark._jump");
  });

  test("CommentItemTreeItem: FIX*/BUG* tags get the warning icon", () => {
    for (const tag of ["FIXME", "FIX", "BUG"]) {
      const entry: CommentEntry = { tag, message: "broken", line: 0 };
      const item = createCommentItemTreeItem(entry, "file:///test.ts", "L1: broken");
      assert.strictEqual(item.kind, "commentItem");
      assert.ok(
        item.iconPath instanceof vscode.ThemeIcon && item.iconPath.id === "warning",
        `${tag} icon should be 'warning'`,
      );
    }
  });

  test("CommentItemTreeItem: other tags get the check-circle icon", () => {
    const entry: CommentEntry = { tag: "TODO", message: "implement", line: 2 };
    const item = createCommentItemTreeItem(entry, "file:///test.ts", "L3: implement");
    assert.ok(
      item.iconPath instanceof vscode.ThemeIcon && item.iconPath.id === "check-circle",
      "TODO icon should be 'check-circle'",
    );
  });

  test("CommentItemTreeItem: command selection starts at the entry line", () => {
    const entry: CommentEntry = { tag: "TODO", message: "test", line: 3 };
    const item = createCommentItemTreeItem(entry, "file:///test.ts", "L4: test");
    const args = item.command?.arguments;
    assert.ok(Array.isArray(args) && args.length >= 2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const sel = (args[1] as { selection: vscode.Range }).selection;
    assert.strictEqual(sel.start.line, 3);
  });
});

suite("markers-tree — getChildren()", () => {
  test("no element → Bookmarks and Comments sections", () => {
    const provider = createMarkersTreeProvider(() => []);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.ok(children[0].kind === "section" && children[0].sectionId === "bookmarks");
    assert.ok(children[1].kind === "section" && children[1].sectionId === "comments");
  });

  test("bookmarks section with no bookmarks → placeholder", () => {
    const provider = createMarkersTreeProvider(() => []);
    const children = provider.getChildren(createSectionTreeItem("Bookmarks", "bookmarks"));
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "placeholder");
    assert.strictEqual(children[0].label, "No bookmarks");
  });

  test("comments section with no comments → 'No comments found' placeholder", () => {
    const provider = createMarkersTreeProvider(() => []);
    const children = provider.getChildren(createSectionTreeItem("Comments", "comments"));
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "placeholder");
    assert.strictEqual(children[0].label, "No comments found");
  });

  test("bookmarks section dedupes and sorts files by URI", () => {
    const bms: Bookmark[] = [
      { uri: "file:///b.ts", line: 0 },
      { uri: "file:///a.ts", line: 2 },
      { uri: "file:///b.ts", line: 5 },
    ];
    const provider = createMarkersTreeProvider(() => bms);
    const children = provider.getChildren(createSectionTreeItem("Bookmarks", "bookmarks"));
    assert.strictEqual(children.length, 2);
    assert.ok(children[0].kind === "markerFile" && children[1].kind === "markerFile");
    assert.ok(children[0].bookmarkUri < children[1].bookmarkUri);
  });

  test("bookmark file → items sorted by line ascending", () => {
    const uri = "file:///test.ts";
    const bms: Bookmark[] = [
      { uri, line: 10 },
      { uri, line: 2 },
      { uri, line: 7 },
    ];
    const provider = createMarkersTreeProvider(() => bms);
    const children = provider.getChildren(createMarkerFileTreeItem(uri, "test.ts", "bookmarks"));
    assert.strictEqual(children.length, 3);
    assert.ok(children[0].kind === "bookmarkItem");
    assert.strictEqual(children[0].bookmark.line, 2);
    assert.ok(children[2].kind === "bookmarkItem");
    assert.strictEqual(children[2].bookmark.line, 10);
  });

  test("other element types → empty array", () => {
    const provider = createMarkersTreeProvider(() => []);
    const bm: Bookmark = { uri: "file:///test.ts", line: 0 };
    assert.deepStrictEqual(provider.getChildren(createPlaceholderTreeItem("x")), []);
    assert.deepStrictEqual(provider.getChildren(createBookmarkItemTreeItem(bm, "L1: x")), []);
  });
});

suite("markers-tree — comment scanning", () => {
  test("refreshComments populates word-tag comment items sorted by line", async () => {
    const provider = createMarkersTreeProvider(() => []);

    const initial = waitForRefresh(provider);
    provider.setVisible(true);
    await initial;

    // FIXME on line 0, TODO on line 1; symbol tags are decoration-only and not listed
    const doc = await vscode.workspace.openTextDocument({
      content: "// FIXME: broken\n// TODO: fix this\n// ! ignored in tree",
      language: "typescript",
    });
    const uri = doc.uri.toString();

    const refreshed = waitForRefresh(provider);
    provider.refreshComments(uri);
    await refreshed;

    const [, commentsSection] = provider.getChildren();
    const fileItems = provider.getChildren(commentsSection);
    const fileItem = fileItems.find(
      (fi): fi is MarkerFileTreeItem => fi.kind === "markerFile" && fi.bookmarkUri === uri,
    );
    assert.ok(fileItem, "should have a file item for the test document");

    const items = provider.getChildren(fileItem);
    assert.strictEqual(items.length, 2, "only the two word tags should be listed");
    assert.ok(typeof items[0].label === "string" && items[0].label.startsWith("L1:"));
    assert.ok(typeof items[1].label === "string" && items[1].label.startsWith("L2:"));
  });
});

suite("markers-tree — label format", () => {
  test("bookmark item label is '(unavailable)' when lineCache is empty", () => {
    const uri = "file:///test.ts";
    const provider = createMarkersTreeProvider(() => [{ uri, line: 4 }]);
    const children = provider.getChildren(createMarkerFileTreeItem(uri, "test.ts", "bookmarks"));
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "bookmarkItem");
    assert.strictEqual(children[0].label, "L5: (unavailable)");
  });
});

suite("markers-tree — lazy loading", () => {
  test("refresh* when not visible does not fire onDidChangeTreeData", () => {
    const provider = createMarkersTreeProvider(() => []);
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refreshBookmarks();
    provider.refreshComments("file:///test.ts");
    provider.removeComment("file:///test.ts");
    assert.strictEqual(fired, false);
  });
});

suite("markers-tree — API surface", () => {
  test("createMarkersTreeProvider returns the expected API", () => {
    const provider = createMarkersTreeProvider(() => []);
    assert.strictEqual(typeof provider.getChildren, "function");
    assert.strictEqual(typeof provider.getTreeItem, "function");
    assert.strictEqual(typeof provider.setVisible, "function");
    assert.strictEqual(typeof provider.refreshBookmarks, "function");
    assert.strictEqual(typeof provider.refreshComments, "function");
    assert.strictEqual(typeof provider.removeComment, "function");
    assert.strictEqual(typeof provider.refreshAll, "function");
    assert.ok(provider.onDidChangeTreeData !== undefined);
  });
});
