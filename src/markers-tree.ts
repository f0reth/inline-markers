import {
  Event,
  EventEmitter,
  Position,
  Range,
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
} from "vscode";

import { parseDocument, TagMatch } from "./comments";
import { Bookmark } from "./types";

export class SectionTreeItem extends TreeItem {
  readonly sectionId: "bookmarks" | "comments";

  constructor(label: string, sectionId: "bookmarks" | "comments") {
    super(label, TreeItemCollapsibleState.Expanded);
    this.sectionId = sectionId;
  }
}

export class PlaceholderTreeItem extends TreeItem {
  constructor(label: string) {
    super(label, TreeItemCollapsibleState.None);
  }
}

export class MarkerFileTreeItem extends TreeItem {
  readonly bookmarkUri: string;
  readonly sectionId: "bookmarks" | "comments";

  constructor(uri: string, label: string, sectionId: "bookmarks" | "comments") {
    super(label, TreeItemCollapsibleState.Expanded);
    this.bookmarkUri = uri;
    this.sectionId = sectionId;
    this.contextValue = sectionId === "bookmarks" ? "bookmarkFile" : "commentFile";
    this.resourceUri = Uri.parse(uri);
    this.iconPath = ThemeIcon.File;
    this.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [Uri.parse(uri)],
    };
  }
}

export { MarkerFileTreeItem as BookmarkFileTreeItem };

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

export class CommentItemTreeItem extends TreeItem {
  constructor(match: TagMatch, uri: string, label: string) {
    super(label, TreeItemCollapsibleState.None);
    this.contextValue = "commentItem";
    if (match.key === "fixme") {
      this.iconPath = new ThemeIcon("warning", new ThemeColor("list.warningForeground"));
    } else {
      this.iconPath = new ThemeIcon("check-circle");
    }
    const { line } = match.range.start;
    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [
        Uri.parse(uri),
        { selection: new Range(new Position(line, 0), new Position(line, 0)) },
      ],
    };
  }
}

type MarkersTreeNode =
  | SectionTreeItem
  | MarkerFileTreeItem
  | BookmarkItemTreeItem
  | CommentItemTreeItem
  | PlaceholderTreeItem;

class MarkersTreeProvider implements TreeDataProvider<MarkersTreeNode> {
  private readonly _onDidChangeTreeData = new EventEmitter<undefined>();
  readonly onDidChangeTreeData: Event<undefined> = this._onDidChangeTreeData.event;

  private commentCache = new Map<string, TagMatch[]>();
  private lineCache = new Map<string, Map<number, string>>();
  private _visible = false;
  private _dirty = true;

  constructor(private readonly getBookmarks: () => Bookmark[]) {}

  setVisible(v: boolean): void {
    this._visible = v;
    if (v) {
      if (this._dirty) {
        void this.refreshAll();
      } else {
        this._onDidChangeTreeData.fire(undefined);
      }
    }
  }

  refreshBookmarks(uri?: string): void {
    if (!this._visible) {
      this._dirty = true;
      return;
    }
    if (uri) {
      void this._loadBookmarkUri(uri).then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    } else {
      void this._reloadAllBookmarks().then(() => {
        this._onDidChangeTreeData.fire(undefined);
      });
    }
  }

  refreshComments(uri: string): void {
    if (!this._visible) {
      this._dirty = true;
      return;
    }
    void this._scanFile(uri).then(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  removeComment(uri: string): void {
    if (!this._visible) {
      this._dirty = true;
      return;
    }
    this.commentCache.delete(uri);
    this._onDidChangeTreeData.fire(undefined);
  }

  async refreshAll(): Promise<void> {
    if (!this._visible) {
      this._onDidChangeTreeData.fire(undefined);
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

    this.commentCache.clear();

    for (const file of files) {
      await this._scanFileWithConfig(file.toString(), multilineComments, excludeLanguages);
    }

    await this._reloadAllBookmarks();

    this._dirty = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  private async _scanFile(uri: string): Promise<void> {
    const multilineComments = workspace
      .getConfiguration("inline-markers.comments")
      .get("multilineComments", true);
    const excludeLanguages = workspace
      .getConfiguration("inline-markers.comments")
      .get("excludeLanguages", ["markdown", "mdx"]);
    await this._scanFileWithConfig(uri, multilineComments, excludeLanguages);
  }

  private async _scanFileWithConfig(
    uri: string,
    multilineComments: boolean,
    excludeLanguages: string[],
  ): Promise<void> {
    try {
      const doc = await workspace.openTextDocument(Uri.parse(uri));
      if (excludeLanguages.includes(doc.languageId)) return;
      const matches = parseDocument(doc, multilineComments);
      if (matches.length > 0) {
        this.commentCache.set(uri, matches);
      } else {
        this.commentCache.delete(uri);
      }
    } catch {
      // File unavailable
    }
  }

  private async _reloadAllBookmarks(): Promise<void> {
    const bookmarks = this.getBookmarks();
    const uris = new Set(bookmarks.map((b) => b.uri));
    this.lineCache.clear();
    for (const uri of uris) {
      await this._loadBookmarkUri(uri);
    }
  }

  private async _loadBookmarkUri(uri: string): Promise<void> {
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

  getTreeItem(element: MarkersTreeNode): TreeItem {
    return element;
  }

  getChildren(element?: MarkersTreeNode): MarkersTreeNode[] {
    if (!element) {
      return [
        new SectionTreeItem("Bookmarks", "bookmarks"),
        new SectionTreeItem("TODO / FIXME", "comments"),
      ];
    }

    if (element instanceof SectionTreeItem) {
      return element.sectionId === "bookmarks" ? this._getBookmarkFiles() : this._getCommentFiles();
    }

    if (element instanceof MarkerFileTreeItem) {
      return element.sectionId === "bookmarks"
        ? this._getBookmarkItems(element.bookmarkUri)
        : this._getCommentItems(element.bookmarkUri);
    }

    return [];
  }

  private _getBookmarkFiles(): MarkersTreeNode[] {
    const bookmarks = this.getBookmarks();
    if (bookmarks.length === 0) {
      return [new PlaceholderTreeItem("No bookmarks")];
    }
    const seen = new Set<string>();
    const fileItems: MarkerFileTreeItem[] = [];
    for (const b of bookmarks) {
      if (!seen.has(b.uri)) {
        seen.add(b.uri);
        const parts = Uri.parse(b.uri).fsPath.split(/[\\/]/);
        const label = parts.at(-1) ?? b.uri;
        fileItems.push(new MarkerFileTreeItem(b.uri, label, "bookmarks"));
      }
    }
    fileItems.sort((a, b) => a.bookmarkUri.localeCompare(b.bookmarkUri));
    return fileItems;
  }

  private _getBookmarkItems(uri: string): MarkersTreeNode[] {
    const bookmarks = this.getBookmarks()
      .filter((b) => b.uri === uri)
      .toSorted((a, b) => a.line - b.line);
    return bookmarks.map((b) => {
      const lineMap = this.lineCache.get(b.uri);
      const lineText = lineMap?.get(b.line);
      const label =
        lineText != null ? `L${b.line + 1}: ${lineText}` : `L${b.line + 1}: (unavailable)`;
      return new BookmarkItemTreeItem(b, label);
    });
  }

  private _getCommentFiles(): MarkersTreeNode[] {
    if (this.commentCache.size === 0) {
      return [new PlaceholderTreeItem("No TODO/FIXME found")];
    }
    const uris = [...this.commentCache.keys()].toSorted();
    return uris.map((uri) => {
      const parts = Uri.parse(uri).fsPath.split(/[\\/]/);
      const label = parts.at(-1) ?? uri;
      return new MarkerFileTreeItem(uri, label, "comments");
    });
  }

  private _getCommentItems(uri: string): MarkersTreeNode[] {
    const matches = this.commentCache.get(uri) ?? [];
    return matches
      .toSorted((a, b) => a.range.start.line - b.range.start.line)
      .map((match) => {
        const label = `L${match.range.start.line + 1}: ${match.message}`;
        return new CommentItemTreeItem(match, uri, label);
      });
  }
}

export function createMarkersTreeProvider(getBookmarks: () => Bookmark[]): MarkersTreeProvider {
  return new MarkersTreeProvider(getBookmarks);
}
