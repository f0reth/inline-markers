import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextDocumentChangeEvent,
  TextEditor,
  TextEditorDecorationType,
  Uri,
  window,
} from "vscode";

import { Bookmark } from "./types";

const STORAGE_KEY = "inline-markers.bookmarks";

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

export function createBookmarkManager(context: BookmarkContext, onChanged: (uri?: string) => void) {
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
    onChanged(uriStr);
  }

  async function clearAll(): Promise<void> {
    await persist([]);
    updateDecorations(window.activeTextEditor);
    onChanged();
  }

  async function clearFile(uriStr: string): Promise<void> {
    const bookmarks = load().filter((b) => b.uri !== uriStr);
    await persist(bookmarks);
    updateDecorations(window.activeTextEditor);
    onChanged(uriStr);
  }

  async function deleteBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = load().filter((b) => !(b.uri === bookmark.uri && b.line === bookmark.line));
    await persist(bookmarks);
    updateDecorations(window.activeTextEditor);
    onChanged(bookmark.uri);
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
    getBookmarks: load,
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
