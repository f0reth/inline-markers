import {
  Event,
  EventEmitter,
  Position,
  Range,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
} from "vscode";

import { parseDocument, TagMatch } from "./comments";
import { Bookmark } from "./types";

export type SectionTreeItem = TreeItem & {
  readonly kind: "section";
  readonly sectionId: "bookmarks" | "comments";
};
export function createSectionTreeItem(
  label: string,
  sectionId: "bookmarks" | "comments",
): SectionTreeItem {
  return Object.assign(new TreeItem(label, TreeItemCollapsibleState.Expanded), {
    kind: "section" as const,
    sectionId,
  });
}

export type PlaceholderTreeItem = TreeItem & {
  readonly kind: "placeholder";
};
export function createPlaceholderTreeItem(label: string): PlaceholderTreeItem {
  return Object.assign(new TreeItem(label, TreeItemCollapsibleState.None), {
    kind: "placeholder" as const,
  });
}

export type MarkerFileTreeItem = TreeItem & {
  readonly kind: "markerFile";
  readonly bookmarkUri: string;
  readonly sectionId: "bookmarks" | "comments";
};
export function createMarkerFileTreeItem(
  uri: string,
  label: string,
  sectionId: "bookmarks" | "comments",
): MarkerFileTreeItem {
  const item = Object.assign(new TreeItem(label, TreeItemCollapsibleState.Expanded), {
    kind: "markerFile" as const,
    bookmarkUri: uri,
    sectionId,
  });
  item.contextValue = sectionId === "bookmarks" ? "bookmarkFile" : "commentFile";
  item.resourceUri = Uri.parse(uri);
  item.iconPath = ThemeIcon.File;
  item.command = {
    command: "vscode.open",
    title: "Open File",
    arguments: [Uri.parse(uri)],
  };
  return item;
}

export { MarkerFileTreeItem as BookmarkFileTreeItem };

export type BookmarkItemTreeItem = TreeItem & {
  readonly kind: "bookmarkItem";
  readonly bookmark: Bookmark;
};
export function createBookmarkItemTreeItem(
  bookmark: Bookmark,
  label: string,
): BookmarkItemTreeItem {
  const item = Object.assign(new TreeItem(label, TreeItemCollapsibleState.None), {
    kind: "bookmarkItem" as const,
    bookmark,
  });
  item.contextValue = "bookmarkItem";
  item.iconPath = new ThemeIcon("bookmark");
  item.command = {
    command: "inline-markers.bookmark._jump",
    title: "Jump",
    arguments: [bookmark],
  };
  return item;
}

export type CommentItemTreeItem = TreeItem & {
  readonly kind: "commentItem";
};
export function createCommentItemTreeItem(
  match: TagMatch,
  uri: string,
  label: string,
): CommentItemTreeItem {
  const item = Object.assign(new TreeItem(label, TreeItemCollapsibleState.None), {
    kind: "commentItem" as const,
  });
  item.contextValue = "commentItem";
  if (match.key === "fixme") {
    item.iconPath = new ThemeIcon("warning", new ThemeColor("list.warningForeground"));
  } else {
    item.iconPath = new ThemeIcon("check-circle");
  }
  const { line } = match.range.start;
  item.command = {
    command: "vscode.open",
    title: "Open",
    arguments: [
      Uri.parse(uri),
      { selection: new Range(new Position(line, 0), new Position(line, 0)) },
    ],
  };
  return item;
}

export type MarkersTreeNode =
  | SectionTreeItem
  | MarkerFileTreeItem
  | BookmarkItemTreeItem
  | CommentItemTreeItem
  | PlaceholderTreeItem;

export type MarkersTreeProvider = {
  onDidChangeTreeData: Event<undefined>;
  getTreeItem(element: MarkersTreeNode): TreeItem;
  getChildren(element?: MarkersTreeNode): MarkersTreeNode[];
  setVisible(v: boolean): void;
  refreshBookmarks(uri?: string): void;
  refreshComments(uri: string): void;
  removeComment(uri: string): void;
  refreshAll(): Promise<void>;
};

function _getTreeItem(element: MarkersTreeNode): TreeItem {
  return element;
}

export function createMarkersTreeProvider(getBookmarks: () => Bookmark[]): MarkersTreeProvider {
  const _onDidChangeTreeData = new EventEmitter<undefined>();
  const onDidChangeTreeData: Event<undefined> = _onDidChangeTreeData.event;
  const commentCache = new Map<string, TagMatch[]>();
  const lineCache = new Map<string, Map<number, string>>();
  let _visible = false;
  let _dirty = true;

  async function _scanFileWithConfig(
    uri: string,
    multilineComments: boolean,
    excludeLanguages: string[],
  ): Promise<void> {
    try {
      const doc = await workspace.openTextDocument(Uri.parse(uri));
      if (excludeLanguages.includes(doc.languageId)) return;
      const matches = parseDocument(doc, multilineComments);
      if (matches.length > 0) {
        commentCache.set(uri, matches);
      } else {
        commentCache.delete(uri);
      }
    } catch {
      // File unavailable
    }
  }

  async function _scanFile(uri: string): Promise<void> {
    const multilineComments = workspace
      .getConfiguration("inline-markers.comments")
      .get("multilineComments", true);
    const excludeLanguages = workspace
      .getConfiguration("inline-markers.comments")
      .get("excludeLanguages", ["markdown", "mdx"]);
    await _scanFileWithConfig(uri, multilineComments, excludeLanguages);
  }

  async function _loadBookmarkUri(uri: string): Promise<void> {
    try {
      const doc = await workspace.openTextDocument(Uri.parse(uri));
      const lineMap = new Map<number, string>();
      for (let i = 0; i < doc.lineCount; i++) {
        lineMap.set(i, doc.lineAt(i).text.trim());
      }
      lineCache.set(uri, lineMap);
    } catch {
      // File unavailable
    }
  }

  async function _reloadAllBookmarks(): Promise<void> {
    const bookmarks = getBookmarks();
    const uris = new Set(bookmarks.map((b) => b.uri));
    lineCache.clear();
    for (const uri of uris) {
      await _loadBookmarkUri(uri);
    }
  }

  async function refreshAll(): Promise<void> {
    if (!_visible) {
      _onDidChangeTreeData.fire(undefined);
      return;
    }

    const searchExclude = workspace
      .getConfiguration("search")
      .get<Record<string, boolean>>("exclude", {});
    const excludeKeys = Object.entries(searchExclude)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const excludeGlob = excludeKeys.length > 0 ? `{${excludeKeys.join(",")}}` : undefined;

    const files = await workspace.findFiles("**/*", excludeGlob);
    const multilineComments = workspace
      .getConfiguration("inline-markers.comments")
      .get("multilineComments", true);
    const excludeLanguages = workspace
      .getConfiguration("inline-markers.comments")
      .get("excludeLanguages", ["markdown", "mdx"]);

    commentCache.clear();

    for (const file of files) {
      await _scanFileWithConfig(file.toString(), multilineComments, excludeLanguages);
    }

    await _reloadAllBookmarks();

    _dirty = false;
    _onDidChangeTreeData.fire(undefined);
  }

  function setVisible(v: boolean): void {
    _visible = v;
    if (v) {
      if (_dirty) {
        void refreshAll();
      } else {
        _onDidChangeTreeData.fire(undefined);
      }
    }
  }

  function refreshBookmarks(uri?: string): void {
    if (!_visible) {
      _dirty = true;
      return;
    }
    if (uri) {
      void _loadBookmarkUri(uri).then(() => {
        _onDidChangeTreeData.fire(undefined);
      });
    } else {
      void _reloadAllBookmarks().then(() => {
        _onDidChangeTreeData.fire(undefined);
      });
    }
  }

  function refreshComments(uri: string): void {
    if (!_visible) {
      _dirty = true;
      return;
    }
    void _scanFile(uri).then(() => {
      _onDidChangeTreeData.fire(undefined);
    });
  }

  function removeComment(uri: string): void {
    if (!_visible) {
      _dirty = true;
      return;
    }
    commentCache.delete(uri);
    _onDidChangeTreeData.fire(undefined);
  }

  function _getBookmarkFiles(): MarkersTreeNode[] {
    const bookmarks = getBookmarks();
    if (bookmarks.length === 0) {
      return [createPlaceholderTreeItem("No bookmarks")];
    }
    const seen = new Set<string>();
    const fileItems: MarkerFileTreeItem[] = [];
    for (const b of bookmarks) {
      if (!seen.has(b.uri)) {
        seen.add(b.uri);
        const parts = Uri.parse(b.uri).fsPath.split(/[\\/]/);
        const label = parts.at(-1) ?? b.uri;
        fileItems.push(createMarkerFileTreeItem(b.uri, label, "bookmarks"));
      }
    }
    fileItems.sort((a, b) => a.bookmarkUri.localeCompare(b.bookmarkUri));
    return fileItems;
  }

  function _getBookmarkItems(uri: string): MarkersTreeNode[] {
    const bookmarks = getBookmarks()
      .filter((b) => b.uri === uri)
      .toSorted((a, b) => a.line - b.line);
    return bookmarks.map((b) => {
      const lineMap = lineCache.get(b.uri);
      const lineText = lineMap?.get(b.line);
      const label =
        lineText != null ? `L${b.line + 1}: ${lineText}` : `L${b.line + 1}: (unavailable)`;
      return createBookmarkItemTreeItem(b, label);
    });
  }

  function _getCommentFiles(): MarkersTreeNode[] {
    if (commentCache.size === 0) {
      return [createPlaceholderTreeItem("No TODO/FIXME found")];
    }
    const uris = [...commentCache.keys()].toSorted();
    return uris.map((uri) => {
      const parts = Uri.parse(uri).fsPath.split(/[\\/]/);
      const label = parts.at(-1) ?? uri;
      return createMarkerFileTreeItem(uri, label, "comments");
    });
  }

  function _getCommentItems(uri: string): MarkersTreeNode[] {
    const matches = commentCache.get(uri) ?? [];
    return matches
      .toSorted((a, b) => a.range.start.line - b.range.start.line)
      .map((match) => {
        const label = `L${match.range.start.line + 1}: ${match.message}`;
        return createCommentItemTreeItem(match, uri, label);
      });
  }

  function getChildren(element?: MarkersTreeNode): MarkersTreeNode[] {
    if (!element) {
      return [
        createSectionTreeItem("Bookmarks", "bookmarks"),
        createSectionTreeItem("TODO / FIXME", "comments"),
      ];
    }

    if (element.kind === "section") {
      return element.sectionId === "bookmarks" ? _getBookmarkFiles() : _getCommentFiles();
    }

    if (element.kind === "markerFile") {
      return element.sectionId === "bookmarks"
        ? _getBookmarkItems(element.bookmarkUri)
        : _getCommentItems(element.bookmarkUri);
    }

    return [];
  }

  return {
    onDidChangeTreeData,
    getTreeItem: _getTreeItem,
    getChildren,
    setVisible,
    refreshBookmarks,
    refreshComments,
    removeComment,
    refreshAll,
  };
}
