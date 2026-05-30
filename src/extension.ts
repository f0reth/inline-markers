import {
  DecorationOptions,
  DiagnosticSeverity,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorDecorationType,
  Uri,
  commands,
  languages,
  window,
  workspace,
} from "vscode";

import { createBookmarkManager } from "./bookmark";
import { createBetterComments } from "./comments";
import { ILineOptions, createDiagnosticLine } from "./diagnostic-line";
import { createGutterDecorators } from "./gutter";
import {
  BookmarkFileTreeItem,
  BookmarkItemTreeItem,
  createMarkersTreeProvider,
} from "./markers-tree";
import { Bookmark } from "./types";

export let activationDuration = -1;

const EMPTY_DECO_OPTS: DecorationOptions[] = [];

export function activate(context: ExtensionContext) {
  const _activateStart = performance.now();
  const gutters = createGutterDecorators(context);
  context.subscriptions.push({ dispose: () => gutters.dispose() });

  const diagLine = createDiagnosticLine();
  context.subscriptions.push({ dispose: () => diagLine.dispose() });

  const better = createBetterComments(context);

  let onBookmarksChanged: (uri?: string) => void = (_uri) => {
    void context;
  };

  const bookmarkManager = createBookmarkManager(context, (uri?) => onBookmarksChanged(uri));
  context.subscriptions.push({ dispose: () => bookmarkManager.dispose() });

  const markersTreeProvider = createMarkersTreeProvider(bookmarkManager.getBookmarks);
  onBookmarksChanged = (uri?) => {
    if (uri) markersTreeProvider.refreshBookmarks(uri);
    else markersTreeProvider.refreshBookmarks();
  };

  const markersTreeView = window.createTreeView("inline-markers.markers", {
    treeDataProvider: markersTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(markersTreeView);
  context.subscriptions.push(
    markersTreeView.onDidChangeVisibility((e) => {
      markersTreeProvider.setVisible(e.visible);
    }),
  );

  const gutterPairs: [TextEditorDecorationType, DiagnosticSeverity][] = [
    [gutters.errorGutter, DiagnosticSeverity.Error],
    [gutters.warnGutter, DiagnosticSeverity.Warning],
    [gutters.infoGutter, DiagnosticSeverity.Information],
    [gutters.hintGutter, DiagnosticSeverity.Hint],
  ];

  let gutterEnabled = true;

  const severityMap = new Map<DiagnosticSeverity, DecorationOptions[]>([
    [DiagnosticSeverity.Error, []],
    [DiagnosticSeverity.Warning, []],
    [DiagnosticSeverity.Information, []],
    [DiagnosticSeverity.Hint, []],
  ]);
  const lineOptions: ILineOptions[] = [];

  function updateSettings() {
    const config = workspace.getConfiguration("inline-markers");
    gutterEnabled = config.get("gutter.enabled", true);
    diagLine.updateSettings({
      showLine: config.get("diagnosticLine.enabled", true),
      errorLabelBg: config.get("diagnosticLine.errorLabelBg", "#d32f2f88"),
      warnLabelBg: config.get("diagnosticLine.warnLabelBg", "#ff980088"),
      errFontColor: config.get("diagnosticLine.errFontColor", "#efefef"),
      warnFontColor: config.get("diagnosticLine.warnFontColor", "#000000"),
      maxLineLength: config.get("diagnosticLine.maxLineLength", 120),
    });
    better.updateSettingsAndRecreate();
  }

  updateSettings();

  function updateDiagnosticsOnly(editor: TextEditor | undefined) {
    if (!editor) return;

    const diagnostics = languages.getDiagnostics(editor.document.uri);
    const bookmarkedLines = bookmarkManager.getBookmarkedLines(editor.document.uri);
    for (const arr of severityMap.values()) arr.length = 0;
    lineOptions.length = 0;

    for (const d of diagnostics) {
      if (!bookmarkedLines.has(d.range.start.line)) {
        severityMap.get(d.severity)?.push({ range: d.range, hoverMessage: d.message });
      }
      const lineEnd = editor.document.lineAt(d.range.start.line).range.end;
      lineOptions.push({
        severity: d.severity,
        message: d.message,
        range: new Range(lineEnd, lineEnd),
      });
    }

    for (const [gutter, severity] of gutterPairs) {
      editor.setDecorations(gutter, gutterEnabled ? severityMap.get(severity)! : EMPTY_DECO_OPTS);
    }

    diagLine.updateForTextDocument(editor.document.uri, lineOptions);
    diagLine.showLineDecoratorForDocument(editor.document.uri);
  }

  function updateAll(editor: TextEditor | undefined) {
    if (!editor) return;
    updateDiagnosticsOnly(editor);
    better.analyzeDocument(editor.document);
    better.showForDocument(editor.document.uri);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let diagTimeout: ReturnType<typeof setTimeout> | undefined;

  const scheduleUpdate = (immediate = false) => {
    if (timeout) clearTimeout(timeout);
    if (immediate) {
      updateAll(window.activeTextEditor);
      return;
    }
    timeout = setTimeout(() => updateAll(window.activeTextEditor), 200);
  };

  const scheduleDiagnosticsUpdate = () => {
    if (diagTimeout) clearTimeout(diagTimeout);
    diagTimeout = setTimeout(() => updateDiagnosticsOnly(window.activeTextEditor), 200);
  };

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      bookmarkManager.updateDecorations(editor);
      scheduleUpdate(true);
    }),
    workspace.onDidChangeTextDocument((e) => {
      if (e.document === window.activeTextEditor?.document) scheduleUpdate();
    }),
    workspace.onDidChangeTextDocument(async (e) => {
      await bookmarkManager.shiftBookmarks(e.document.uri.toString(), e);
    }),
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("inline-markers")) {
        updateSettings();
        scheduleUpdate(true);
      }
      if (
        e.affectsConfiguration("inline-markers.comments.excludeLanguages") ||
        e.affectsConfiguration("inline-markers.comments.multilineComments")
      ) {
        void markersTreeProvider.refreshAll();
      }
    }),
    languages.onDidChangeDiagnostics(() => scheduleDiagnosticsUpdate()),
    { dispose: () => better.dispose() },
  );

  context.subscriptions.push(
    workspace.onDidSaveTextDocument((doc) => {
      markersTreeProvider.refreshComments(doc.uri.toString());
    }),
    workspace.onDidDeleteFiles((e) => {
      for (const file of e.files) {
        markersTreeProvider.removeComment(file.toString());
      }
    }),
    workspace.onDidRenameFiles((e) => {
      for (const { oldUri, newUri } of e.files) {
        markersTreeProvider.removeComment(oldUri.toString());
        markersTreeProvider.refreshComments(newUri.toString());
      }
    }),
    commands.registerCommand("inline-markers.markers.refresh", () => {
      void markersTreeProvider.refreshAll();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand("inline-markers.bookmark.toggle", async () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const { line } = editor.selection.active;
      await bookmarkManager.toggle(editor.document.uri.toString(), line);
    }),
    commands.registerCommand("inline-markers.bookmark.navigateNext", () => {
      bookmarkManager.navigateNext();
    }),
    commands.registerCommand("inline-markers.bookmark.navigatePrevious", () => {
      bookmarkManager.navigatePrevious();
    }),
    commands.registerCommand("inline-markers.bookmark.clearAll", async () => {
      await bookmarkManager.clearAll();
    }),
    commands.registerCommand(
      "inline-markers.bookmark.deleteItem",
      async (item: BookmarkItemTreeItem) => {
        await bookmarkManager.deleteBookmark(item.bookmark);
      },
    ),
    commands.registerCommand(
      "inline-markers.bookmark.clearFile",
      async (arg?: BookmarkFileTreeItem) => {
        const uriStr =
          arg instanceof BookmarkFileTreeItem
            ? arg.bookmarkUri
            : window.activeTextEditor?.document.uri.toString();
        if (!uriStr) return;
        await bookmarkManager.clearFile(uriStr);
      },
    ),
    commands.registerCommand("inline-markers.bookmark._jump", async (bookmark: Bookmark) => {
      await window.showTextDocument(Uri.parse(bookmark.uri), {
        selection: new Selection(new Position(bookmark.line, 0), new Position(bookmark.line, 0)),
      });
    }),
  );

  scheduleUpdate(true);
  activationDuration = performance.now() - _activateStart;
  return { activationDuration };
}

export function deactivate() {
  // context.subscriptions に任せる
}
