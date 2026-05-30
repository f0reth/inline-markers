import { TextDecoder } from "node:util";

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

import { compileMatcher, globToRegExp, isExcluded, Matcher, scanText } from "./comment-scanner";
import { DEFAULT_EXCLUDE, DEFAULT_TAGS } from "./configurations";
import { Bookmark } from "./types";

// A scanned word-tag comment, reduced to what the tree needs (the tag token drives the icon).
export interface CommentEntry {
  tag: string;
  message: string;
  line: number;
}

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
  entry: CommentEntry,
  uri: string,
  label: string,
): CommentItemTreeItem {
  const item = Object.assign(new TreeItem(label, TreeItemCollapsibleState.None), {
    kind: "commentItem" as const,
  });
  item.contextValue = "commentItem";
  const upper = entry.tag.toUpperCase();
  if (upper.startsWith("FIX") || upper.startsWith("BUG")) {
    item.iconPath = new ThemeIcon("warning", new ThemeColor("list.warningForeground"));
  } else {
    item.iconPath = new ThemeIcon("check-circle");
  }
  item.command = {
    command: "vscode.open",
    title: "Open",
    arguments: [
      Uri.parse(uri),
      { selection: new Range(new Position(entry.line, 0), new Position(entry.line, 0)) },
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

interface ScanConfig {
  matcher: Matcher;
  multiline: boolean;
  excludeRes: RegExp[];
  excludeGlobs: string[];
}

function readScanConfig(): ScanConfig {
  const config = workspace.getConfiguration("inline-markers.comments");
  const tags = config.get("tags", DEFAULT_TAGS);
  const multiline = config.get("multilineComments", true);
  const excludeGlobs = config.get("exclude", DEFAULT_EXCLUDE);
  return {
    matcher: compileMatcher(tags),
    multiline,
    excludeRes: excludeGlobs.map(globToRegExp),
    excludeGlobs,
  };
}

function _getTreeItem(element: MarkersTreeNode): TreeItem {
  return element;
}

// max number of files scanned concurrently during a full refresh
const SCAN_CONCURRENCY = 24;

export function createMarkersTreeProvider(getBookmarks: () => Bookmark[]): MarkersTreeProvider {
  const _onDidChangeTreeData = new EventEmitter<undefined>();
  const onDidChangeTreeData: Event<undefined> = _onDidChangeTreeData.event;
  const commentCache = new Map<string, CommentEntry[]>();
  const lineCache = new Map<string, Map<number, string>>();
  const decoder = new TextDecoder();
  let _visible = false;
  let _dirty = true;
  let _scanning = false;
  let _rescan = false;

  // prefers an already-open document (reflects unsaved edits, avoids opening new editors and
  // the language-server side effects that openTextDocument triggers); falls back to raw bytes.
  async function _readText(uri: string): Promise<string | undefined> {
    const open = workspace.textDocuments.find((d) => d.uri.toString() === uri);
    if (open) return open.getText();
    try {
      return decoder.decode(await workspace.fs.readFile(Uri.parse(uri)));
    } catch {
      return undefined;
    }
  }

  function _toEntries(text: string, cfg: ScanConfig): CommentEntry[] {
    const entries: CommentEntry[] = [];
    for (const m of scanText(text, cfg.matcher, cfg.multiline)) {
      if (!cfg.matcher.isWord[m.tagIndex]) continue; // tree lists word tags only (TODO/FIXME)
      entries.push({
        tag: cfg.matcher.tags[m.tagIndex].tag,
        message: m.message,
        line: m.range.startLine,
      });
    }
    return entries;
  }

  async function _scanFileInto(uri: string, cfg: ScanConfig): Promise<void> {
    if (isExcluded(Uri.parse(uri).path, cfg.excludeRes)) {
      commentCache.delete(uri);
      return;
    }
    const text = await _readText(uri);
    if (text === undefined) return;
    const entries = _toEntries(text, cfg);
    if (entries.length > 0) commentCache.set(uri, entries);
    else commentCache.delete(uri);
  }

  async function _scanFile(uri: string): Promise<void> {
    await _scanFileInto(uri, readScanConfig());
  }

  async function _loadBookmarkUri(uri: string): Promise<void> {
    const lines = getBookmarks()
      .filter((b) => b.uri === uri)
      .map((b) => b.line);
    if (lines.length === 0) {
      lineCache.delete(uri);
      return;
    }
    const text = await _readText(uri);
    if (text === undefined) {
      lineCache.delete(uri);
      return;
    }
    const allLines = text.split(/\r?\n/);
    const lineMap = new Map<number, string>();
    for (const line of lines) {
      if (line >= 0 && line < allLines.length) lineMap.set(line, allLines[line].trim());
    }
    lineCache.set(uri, lineMap);
  }

  async function _reloadAllBookmarks(): Promise<void> {
    const uris = new Set(getBookmarks().map((b) => b.uri));
    lineCache.clear();
    for (const uri of uris) {
      await _loadBookmarkUri(uri);
    }
  }

  async function _doRefreshAll(): Promise<void> {
    const cfg = readScanConfig();

    const searchExclude = workspace
      .getConfiguration("search")
      .get<Record<string, boolean>>("exclude", {});
    const searchKeys = Object.entries(searchExclude)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const allExcludes = [...cfg.excludeGlobs, ...searchKeys];
    const excludeGlob = allExcludes.length > 0 ? `{${allExcludes.join(",")}}` : undefined;
    const files = await workspace.findFiles("**/*", excludeGlob);

    commentCache.clear();
    for (let i = 0; i < files.length; i += SCAN_CONCURRENCY) {
      const chunk = files.slice(i, i + SCAN_CONCURRENCY);
      await Promise.all(chunk.map((f) => _scanFileInto(f.toString(), cfg)));
    }

    await _reloadAllBookmarks();

    _dirty = false;
    _onDidChangeTreeData.fire(undefined);
  }

  async function refreshAll(): Promise<void> {
    if (!_visible) {
      _onDidChangeTreeData.fire(undefined);
      return;
    }
    // guard against overlapping full scans: a call made while scanning queues exactly one rerun
    if (_scanning) {
      _rescan = true;
      return;
    }
    _scanning = true;
    try {
      do {
        _rescan = false;
        await _doRefreshAll();
      } while (_rescan);
    } finally {
      _scanning = false;
    }
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
      return [createPlaceholderTreeItem("No comments found")];
    }
    const uris = [...commentCache.keys()].toSorted();
    return uris.map((uri) => {
      const parts = Uri.parse(uri).fsPath.split(/[\\/]/);
      const label = parts.at(-1) ?? uri;
      return createMarkerFileTreeItem(uri, label, "comments");
    });
  }

  function _getCommentItems(uri: string): MarkersTreeNode[] {
    const entries = commentCache.get(uri) ?? [];
    return entries
      .toSorted((a, b) => a.line - b.line)
      .map((entry) =>
        createCommentItemTreeItem(entry, uri, `L${entry.line + 1}: ${entry.message}`),
      );
  }

  function getChildren(element?: MarkersTreeNode): MarkersTreeNode[] {
    if (!element) {
      return [
        createSectionTreeItem("Bookmarks", "bookmarks"),
        createSectionTreeItem("Comments", "comments"),
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
