import {
  DecorationOptions,
  Event,
  EventEmitter,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextDocumentChangeEvent,
  TextEditor,
  TextEditorDecorationType,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace,
} from "vscode";

import { Bookmark } from "./types";

const STORAGE_KEY = "inline-markers.bookmarks";

export class BookmarkFileTreeItem extends TreeItem {
  readonly bookmarkUri: string;

  constructor(uri: string, label: string) {
    super(label, TreeItemCollapsibleState.Expanded);
    this.bookmarkUri = uri;
    this.contextValue = "bookmarkFile";
    this.resourceUri = Uri.parse(uri);
    this.iconPath = ThemeIcon.File;
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [Uri.parse(uri)],
    };
  }
}

export class BookmarkItemTreeItem extends TreeItem {
  readonly bookmark: Bookmark;

  constructor(bookmark: Bookmark, label: string) {
    super(label, TreeItemCollapsibleState.None);
    this.bookmark = bookmark;
    this.contextValue = "bookmarkItem";
    this.iconPath = new ThemeIcon("bookmark");
    this.command = {
      command: "inline-markers.bookmark._jump",
      title: "Jump",
      arguments: [bookmark],
    };
  }
}

type BookmarkTreeNode = BookmarkFileTreeItem | BookmarkItemTreeItem;

class BookmarkTreeProvider implements TreeDataProvider<BookmarkTreeNode> {
  private readonly _onDidChangeTreeData = new EventEmitter<undefined>();
  readonly onDidChangeTreeData: Event<undefined> = this._onDidChangeTreeData.event;

  private lineCache = new Map<string, Map<number, string>>();
  private _visible = false;

  constructor(private readonly getBookmarks: () => Bookmark[]) {}

  setVisible(v: boolean): void {
    this._visible = v;
    if (v) {
      void this._reloadAll().then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    }
  }

  refreshUri(uri: string): void {
    if (this._visible) {
      void this._loadUri(uri).then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    } else {
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  refreshAll(): void {
    if (this._visible) {
      void this._reloadAll().then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    } else {
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  private async _reloadAll(): Promise<void> {
    const bookmarks = this.getBookmarks();
    const uris = new Set(bookmarks.map((b) => b.uri));
    this.lineCache.clear();
    for (const uri of uris) {
      await this._loadUri(uri);
    }
  }

  private async _loadUri(uri: string): Promise<void> {
    try {
      const doc = await workspace.openTextDocument(Uri.parse(uri));
      const lineMap = new Map<number, string>();
      for (let i = 0; i < doc.lineCount; i++) {
        lineMap.set(i, doc.lineAt(i).text.trim());
      }
      this.lineCache.set(uri, lineMap);
    } catch {
      // File unavailable
    }
  }

  getTreeItem(element: BookmarkTreeNode): TreeItem {
    return element;
  }

  getChildren(element?: BookmarkTreeNode): BookmarkTreeNode[] {
    if (!element) {
      const bookmarks = this.getBookmarks();
      const seen = new Set<string>();
      const fileItems: BookmarkFileTreeItem[] = [];
      for (const b of bookmarks) {
        if (!seen.has(b.uri)) {
          seen.add(b.uri);
          const vscUri = Uri.parse(b.uri);
          const parts = vscUri.fsPath.split(/[\\/]/);
          const label = parts.at(-1) ?? b.uri;
          fileItems.push(new BookmarkFileTreeItem(b.uri, label));
        }
      }
      return fileItems;
    }

    if (element instanceof BookmarkFileTreeItem) {
      const bookmarks = this.getBookmarks()
        .filter((b) => b.uri === element.bookmarkUri)
        .toSorted((a, b) => a.line - b.line);
      return bookmarks.map((b) => {
        const lineMap = this.lineCache.get(b.uri);
        const lineText = lineMap?.get(b.line);
        const label =
          lineText != null ? `L${b.line + 1}: ${lineText}` : `L${b.line + 1}: (unavailable)`;
        return new BookmarkItemTreeItem(b, label);
      });
    }

    return [];
  }
}

export function applyShift(
  bookmarks: Bookmark[],
  changes: ReadonlyArray<{
    range: { start: { line: number }; end: { line: number } };
    text: string;
  }>,
): Bookmark[] {
  const sorted = changes.toSorted((a, b) => b.range.start.line - a.range.start.line);
  let current = [...bookmarks];

  for (const change of sorted) {
    const startLine = change.range.start.line;
    const endLine = change.range.end.line;
    const addedLines = change.text.split("\n").length - 1;
    const delta = addedLines - (endLine - startLine);

    if (startLine < endLine) {
      current = current.filter((b) => b.line < startLine || b.line > endLine);
    }

    if (delta !== 0) {
      current = current.map((b) => (b.line > startLine ? { ...b, line: b.line + delta } : b));
    }
  }

  return current;
}

type BookmarkContext = Pick<ExtensionContext, "asAbsolutePath" | "workspaceState">;

export function createBookmarkManager(context: BookmarkContext) {
  const gutterDeco: TextEditorDecorationType = window.createTextEditorDecorationType({
    gutterIconPath: context.asAbsolutePath("images/bookmark.svg"),
    gutterIconSize: "80%",
  });

  function load(): Bookmark[] {
    return context.workspaceState.get<Bookmark[]>(STORAGE_KEY, []);
  }

  function persist(bookmarks: Bookmark[]): Thenable<void> {
    return context.workspaceState.update(STORAGE_KEY, bookmarks);
  }

  const treeProvider = new BookmarkTreeProvider(load);

  function updateDecorations(editor: TextEditor | undefined): void {
    if (!editor) return;
    const uriStr = editor.document.uri.toString();
    const bookmarks = load();
    const opts: DecorationOptions[] = bookmarks
      .filter((b) => b.uri === uriStr)
      .map((b) => ({ range: new Range(b.line, 0, b.line, 0) }));
    editor.setDecorations(gutterDeco, opts);
  }

  async function toggle(uriStr: string, line: number): Promise<void> {
    const bookmarks = load();
    const idx = bookmarks.findIndex((b) => b.uri === uriStr && b.line === line);
    if (idx >= 0) {
      bookmarks.splice(idx, 1);
    } else {
      bookmarks.push({ uri: uriStr, line });
    }
    await persist(bookmarks);
    updateDecorations(window.activeTextEditor);
    treeProvider.refreshUri(uriStr);
  }

  async function clearAll(): Promise<void> {
    await persist([]);
    updateDecorations(window.activeTextEditor);
    treeProvider.refreshAll();
  }

  async function clearFile(uriStr: string): Promise<void> {
    const bookmarks = load().filter((b) => b.uri !== uriStr);
    await persist(bookmarks);
    updateDecorations(window.activeTextEditor);
    treeProvider.refreshUri(uriStr);
  }

  async function deleteBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = load().filter((b) => !(b.uri === bookmark.uri && b.line === bookmark.line));
    await persist(bookmarks);
    updateDecorations(window.activeTextEditor);
    treeProvider.refreshUri(bookmark.uri);
  }

  function _jump(bookmark: Bookmark): void {
    void window.showTextDocument(Uri.parse(bookmark.uri), {
      selection: new Selection(new Position(bookmark.line, 0), new Position(bookmark.line, 0)),
    });
  }

  function navigateNext(): void {
    const editor = window.activeTextEditor;
    if (!editor) return;
    const uriStr = editor.document.uri.toString();
    const fileBookmarks = load()
      .filter((b) => b.uri === uriStr)
      .toSorted((a, b) => a.line - b.line);
    if (fileBookmarks.length === 0) {
      void window.showInformationMessage("No bookmarks in this file.");
      return;
    }
    const currentLine = editor.selection.active.line;
    const next = fileBookmarks.find((b) => b.line > currentLine) ?? fileBookmarks[0];
    _jump(next);
  }

  function navigatePrevious(): void {
    const editor = window.activeTextEditor;
    if (!editor) return;
    const uriStr = editor.document.uri.toString();
    const fileBookmarks = load()
      .filter((b) => b.uri === uriStr)
      .toSorted((a, b) => b.line - a.line);
    if (fileBookmarks.length === 0) {
      void window.showInformationMessage("No bookmarks in this file.");
      return;
    }
    const currentLine = editor.selection.active.line;
    const prev = fileBookmarks.find((b) => b.line < currentLine) ?? fileBookmarks[0];
    _jump(prev);
  }

  function getBookmarkedLines(uri: Uri): Set<number> {
    const uriStr = uri.toString();
    return new Set(
      load()
        .filter((b) => b.uri === uriStr)
        .map((b) => b.line),
    );
  }

  async function shiftBookmarks(uriStr: string, event: TextDocumentChangeEvent): Promise<void> {
    const all = load();
    const fileBookmarks = all.filter((b) => b.uri === uriStr);
    const other = all.filter((b) => b.uri !== uriStr);

    if (fileBookmarks.length === 0) return;

    const shifted = applyShift(fileBookmarks, event.contentChanges);
    await persist([...other, ...shifted]);
    updateDecorations(window.activeTextEditor);
  }

  function dispose(): void {
    gutterDeco.dispose();
  }

  return {
    treeProvider,
    updateDecorations,
    toggle,
    clearAll,
    clearFile,
    deleteBookmark,
    navigateNext,
    navigatePrevious,
    getBookmarkedLines,
    shiftBookmarks,
    dispose,
  };
}
