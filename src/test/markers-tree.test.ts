import * as assert from "node:assert";

import * as vscode from "vscode";

import {
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

suite("markers-tree — tree item classes", () => {
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

  test("MarkerFileTreeItem(bookmarks): contextValue is bookmarkFile", () => {
    const item = createMarkerFileTreeItem("file:///test.ts", "test.ts", "bookmarks");
    assert.strictEqual(item.kind, "markerFile");
    assert.strictEqual(item.contextValue, "bookmarkFile");
  });

  test("MarkerFileTreeItem(comments): contextValue is commentFile", () => {
    const item = createMarkerFileTreeItem("file:///test.ts", "test.ts", "comments");
    assert.strictEqual(item.contextValue, "commentFile");
  });

  test("MarkerFileTreeItem: iconPath is ThemeIcon.File", () => {
    const item = createMarkerFileTreeItem("file:///test.ts", "test.ts", "bookmarks");
    assert.strictEqual(item.iconPath, vscode.ThemeIcon.File);
  });

  test("MarkerFileTreeItem: command opens the file", () => {
    const item = createMarkerFileTreeItem("file:///test.ts", "test.ts", "bookmarks");
    assert.strictEqual(item.command?.command, "vscode.open");
  });

  test("BookmarkItemTreeItem: bookmark property preserved", () => {
    const bm: Bookmark = { uri: "file:///test.ts", line: 5 };
    const item = createBookmarkItemTreeItem(bm, "L6: test");
    assert.strictEqual(item.kind, "bookmarkItem");
    assert.deepStrictEqual(item.bookmark, bm);
  });

  test("BookmarkItemTreeItem: contextValue is bookmarkItem", () => {
    const bm: Bookmark = { uri: "file:///test.ts", line: 5 };
    const item = createBookmarkItemTreeItem(bm, "L6: test");
    assert.strictEqual(item.contextValue, "bookmarkItem");
  });

  test("BookmarkItemTreeItem: command is inline-markers.bookmark._jump", () => {
    const bm: Bookmark = { uri: "file:///test.ts", line: 5 };
    const item = createBookmarkItemTreeItem(bm, "L6: test");
    assert.strictEqual(item.command?.command, "inline-markers.bookmark._jump");
  });

  test("CommentItemTreeItem: fixme key → icon.id is 'warning'", () => {
    const match = {
      key: "fixme" as const,
      message: "broken",
      range: new vscode.Range(0, 0, 0, 10),
      tagRange: new vscode.Range(0, 0, 0, 5),
    };
    const item = createCommentItemTreeItem(match, "file:///test.ts", "L1: broken");
    assert.strictEqual(item.kind, "commentItem");
    assert.ok(
      item.iconPath instanceof vscode.ThemeIcon && item.iconPath.id === "warning",
      "fixme icon should be 'warning'",
    );
  });

  test("CommentItemTreeItem: todo key → icon.id is 'check-circle'", () => {
    const match = {
      key: "todo" as const,
      message: "implement",
      range: new vscode.Range(2, 0, 2, 15),
      tagRange: new vscode.Range(2, 0, 2, 4),
    };
    const item = createCommentItemTreeItem(match, "file:///test.ts", "L3: implement");
    assert.ok(
      item.iconPath instanceof vscode.ThemeIcon && item.iconPath.id === "check-circle",
      "todo icon should be 'check-circle'",
    );
  });

  test("CommentItemTreeItem: command.arguments selection starts at match line", () => {
    const match = {
      key: "todo" as const,
      message: "test",
      range: new vscode.Range(3, 0, 3, 10),
      tagRange: new vscode.Range(3, 0, 3, 4),
    };
    const item = createCommentItemTreeItem(match, "file:///test.ts", "L4: test");
    const args = item.command?.arguments;
    assert.ok(
      Array.isArray(args) && args.length >= 2,
      "command.arguments should have at least 2 elements",
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const sel = (args[1] as { selection: vscode.Range }).selection;
    assert.strictEqual(sel.start.line, 3);
  });
});

suite("markers-tree — MarkersTreeProvider.getChildren()", () => {
  test("no element → 2 sections: Bookmarks and TODO / FIXME", () => {
    const provider = createMarkersTreeProvider(() => []);
    const children = provider.getChildren();
    assert.strictEqual(children.length, 2);
    assert.ok(children[0].kind === "section");
    assert.strictEqual(children[0].sectionId, "bookmarks");
    assert.ok(children[1].kind === "section");
    assert.strictEqual(children[1].sectionId, "comments");
  });

  test("SectionTreeItem(bookmarks) with no bookmarks → PlaceholderTreeItem('No bookmarks')", () => {
    const provider = createMarkersTreeProvider(() => []);
    const section = createSectionTreeItem("Bookmarks", "bookmarks");
    const children = provider.getChildren(section);
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "placeholder");
    assert.strictEqual(children[0].label, "No bookmarks");
  });

  test("SectionTreeItem(bookmarks) with bookmarks → MarkerFileTreeItem[] sorted, deduped by URI", () => {
    const bms: Bookmark[] = [
      { uri: "file:///b.ts", line: 0 },
      { uri: "file:///a.ts", line: 2 },
      { uri: "file:///b.ts", line: 5 },
    ];
    const provider = createMarkersTreeProvider(() => bms);
    const section = createSectionTreeItem("Bookmarks", "bookmarks");
    const children = provider.getChildren(section);
    assert.strictEqual(children.length, 2);
    assert.ok(children[0].kind === "markerFile");
    assert.ok(children[1].kind === "markerFile");
    assert.ok(children[0].bookmarkUri < children[1].bookmarkUri, "items should be sorted by URI");
  });

  test("SectionTreeItem(comments) with no comments → PlaceholderTreeItem('No TODO/FIXME found')", () => {
    const provider = createMarkersTreeProvider(() => []);
    const section = createSectionTreeItem("TODO / FIXME", "comments");
    const children = provider.getChildren(section);
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "placeholder");
    assert.strictEqual(children[0].label, "No TODO/FIXME found");
  });

  test("MarkerFileTreeItem(bookmarks) → BookmarkItemTreeItem[] sorted by line ascending", () => {
    const uri = "file:///test.ts";
    const bms: Bookmark[] = [
      { uri, line: 10 },
      { uri, line: 2 },
      { uri, line: 7 },
    ];
    const provider = createMarkersTreeProvider(() => bms);
    const fileItem = createMarkerFileTreeItem(uri, "test.ts", "bookmarks");
    const children = provider.getChildren(fileItem);
    assert.strictEqual(children.length, 3);
    assert.ok(children[0].kind === "bookmarkItem");
    assert.ok(children[1].kind === "bookmarkItem");
    assert.ok(children[2].kind === "bookmarkItem");
    assert.strictEqual(children[0].bookmark.line, 2);
    assert.strictEqual(children[1].bookmark.line, 7);
    assert.strictEqual(children[2].bookmark.line, 10);
  });

  test("MarkerFileTreeItem(comments) → CommentItemTreeItem[] sorted by line ascending", async () => {
    const provider = createMarkersTreeProvider(() => []);

    const initialRefresh = waitForRefresh(provider);
    provider.setVisible(true);
    await initialRefresh;

    // FIXME on line 0, TODO on line 1
    const doc = await vscode.workspace.openTextDocument({
      content: "// FIXME: broken\n// TODO: fix this",
      language: "typescript",
    });
    const uri = doc.uri.toString();

    const commentRefresh = waitForRefresh(provider);
    provider.refreshComments(uri);
    await commentRefresh;

    const [, commentsSection] = provider.getChildren();
    const fileItems = provider.getChildren(commentsSection);
    const [fileItem] = fileItems.filter(
      (fi): fi is MarkerFileTreeItem => fi.kind === "markerFile" && fi.bookmarkUri === uri,
    );
    assert.ok(fileItem, "should have a file item for the test document");

    const commentItems = provider.getChildren(fileItem);
    assert.ok(commentItems.length >= 2, "should have at least 2 comment items");
    assert.ok(commentItems[0].kind === "commentItem");
    assert.ok(commentItems[1].kind === "commentItem");
    assert.ok(
      typeof commentItems[0].label === "string" && commentItems[0].label.startsWith("L1:"),
      "first item should be L1 (FIXME at line 0)",
    );
    assert.ok(
      typeof commentItems[1].label === "string" && commentItems[1].label.startsWith("L2:"),
      "second item should be L2 (TODO at line 1)",
    );
  });

  test("other element types (placeholder, bookmark item) → empty array", () => {
    const provider = createMarkersTreeProvider(() => []);
    const bm: Bookmark = { uri: "file:///test.ts", line: 0 };
    const placeholder = createPlaceholderTreeItem("test");
    const bookmarkItem = createBookmarkItemTreeItem(bm, "L1: test");
    assert.deepStrictEqual(provider.getChildren(placeholder), []);
    assert.deepStrictEqual(provider.getChildren(bookmarkItem), []);
  });
});

suite("markers-tree — label format", () => {
  test("BookmarkItemTreeItem label 'L{line+1}: (unavailable)' when lineCache is empty", () => {
    const uri = "file:///test.ts";
    const bms: Bookmark[] = [{ uri, line: 4 }];
    const provider = createMarkersTreeProvider(() => bms);
    const fileItem = createMarkerFileTreeItem(uri, "test.ts", "bookmarks");
    const children = provider.getChildren(fileItem);
    assert.strictEqual(children.length, 1);
    assert.ok(children[0].kind === "bookmarkItem");
    assert.strictEqual(children[0].label, "L5: (unavailable)");
  });
});

suite("markers-tree — lazy loading (_visible / _dirty)", () => {
  test("refreshBookmarks() when not visible does not fire onDidChangeTreeData", () => {
    const provider = createMarkersTreeProvider(() => []);
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refreshBookmarks();
    assert.strictEqual(fired, false);
  });

  test("refreshComments() when not visible does not fire onDidChangeTreeData", () => {
    const provider = createMarkersTreeProvider(() => []);
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.refreshComments("file:///test.ts");
    assert.strictEqual(fired, false);
  });

  test("removeComment() when not visible does not fire onDidChangeTreeData", () => {
    const provider = createMarkersTreeProvider(() => []);
    let fired = false;
    provider.onDidChangeTreeData(() => {
      fired = true;
    });
    provider.removeComment("file:///test.ts");
    assert.strictEqual(fired, false);
  });
});

suite("markers-tree — API surface", () => {
  test("createMarkersTreeProvider returns expected API surface", () => {
    const provider = createMarkersTreeProvider(() => []);
    assert.strictEqual(typeof provider.getChildren, "function");
    assert.strictEqual(typeof provider.getTreeItem, "function");
    assert.strictEqual(typeof provider.setVisible, "function");
    assert.strictEqual(typeof provider.refreshBookmarks, "function");
    assert.strictEqual(typeof provider.refreshComments, "function");
    assert.strictEqual(typeof provider.removeComment, "function");
    assert.strictEqual(typeof provider.refreshAll, "function");
    assert.ok(provider.onDidChangeTreeData !== undefined, "onDidChangeTreeData should exist");
  });
});
