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

  // single in-memory source of truth, loaded once; storage is kept in sync via persist()
  let bookmarks: Bookmark[] = context.workspaceState.get<Bookmark[]>(STORAGE_KEY, []);
  const index = new Map<string, Bookmark[]>(); // uri -> its bookmarks (avoids full scans)
  // serializes workspaceState writes so rapid mutations can't interleave into a lost update
  let writeChain: Promise<void> = Promise.resolve();

  function rebuildIndex(): void {
    index.clear();
    for (const b of bookmarks) {
      const arr = index.get(b.uri);
      if (arr) arr.push(b);
      else index.set(b.uri, [b]);
    }
  }
  rebuildIndex();

  function persist(): Promise<void> {
    const snapshot = bookmarks.slice();
    const next = writeChain.then(() => context.workspaceState.update(STORAGE_KEY, snapshot));
    // keep the chain progressing even if one write rejects, preserving write order
    writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function updateDecorations(editor: TextEditor | undefined): void {
    if (!editor) return;
    const uriStr = editor.document.uri.toString();
    const opts: DecorationOptions[] = (index.get(uriStr) ?? []).map((b) => ({
      range: new Range(b.line, 0, b.line, 0),
    }));
    editor.setDecorations(gutterDeco, opts);
  }

  async function commit(uri?: string): Promise<void> {
    rebuildIndex();
    await persist();
    updateDecorations(window.activeTextEditor);
    onChanged(uri);
  }

  async function toggle(uriStr: string, line: number): Promise<void> {
    const existing = index.get(uriStr)?.some((b) => b.line === line) ?? false;
    bookmarks = existing
      ? bookmarks.filter((b) => !(b.uri === uriStr && b.line === line))
      : [...bookmarks, { uri: uriStr, line }];
    await commit(uriStr);
  }

  async function clearAll(): Promise<void> {
    bookmarks = [];
    await commit();
  }

  async function clearFile(uriStr: string): Promise<void> {
    bookmarks = bookmarks.filter((b) => b.uri !== uriStr);
    await commit(uriStr);
  }

  async function deleteBookmark(bookmark: Bookmark): Promise<void> {
    bookmarks = bookmarks.filter((b) => !(b.uri === bookmark.uri && b.line === bookmark.line));
    await commit(bookmark.uri);
  }

  function jump(bookmark: Bookmark): void {
    void window.showTextDocument(Uri.parse(bookmark.uri), {
      selection: new Selection(new Position(bookmark.line, 0), new Position(bookmark.line, 0)),
    });
  }

  function navigateNext(): void {
    const editor = window.activeTextEditor;
    if (!editor) return;
    const fileBookmarks = (index.get(editor.document.uri.toString()) ?? []).toSorted(
      (a, b) => a.line - b.line,
    );
    if (fileBookmarks.length === 0) {
      void window.showInformationMessage("No bookmarks in this file.");
      return;
    }
    const currentLine = editor.selection.active.line;
    jump(fileBookmarks.find((b) => b.line > currentLine) ?? fileBookmarks[0]);
  }

  function navigatePrevious(): void {
    const editor = window.activeTextEditor;
    if (!editor) return;
    const fileBookmarks = (index.get(editor.document.uri.toString()) ?? []).toSorted(
      (a, b) => b.line - a.line,
    );
    if (fileBookmarks.length === 0) {
      void window.showInformationMessage("No bookmarks in this file.");
      return;
    }
    const currentLine = editor.selection.active.line;
    jump(fileBookmarks.find((b) => b.line < currentLine) ?? fileBookmarks[0]);
  }

  function getBookmarkedLines(uri: Uri): Set<number> {
    return new Set((index.get(uri.toString()) ?? []).map((b) => b.line));
  }

  async function shiftBookmarks(uriStr: string, event: TextDocumentChangeEvent): Promise<void> {
    const fileBookmarks = index.get(uriStr);
    if (!fileBookmarks || fileBookmarks.length === 0) return;

    const shifted = applyShift(fileBookmarks, event.contentChanges);
    bookmarks = bookmarks.filter((b) => b.uri !== uriStr).concat(shifted);
    rebuildIndex();
    await persist();
    updateDecorations(window.activeTextEditor);
  }

  function dispose(): void {
    gutterDeco.dispose();
  }

  return {
    getBookmarks: () => bookmarks,
    updateDecorations,
    toggle,
    clearAll,
    clearFile,
    deleteBookmark,
    jump,
    navigateNext,
    navigatePrevious,
    getBookmarkedLines,
    shiftBookmarks,
    dispose,
  };
}
