# CLAUDE.md

このファイルは、リポジトリ内のコードを扱う Claude Code (claude.ai/code) 向けのガイドです。

## コマンド

```bash
# ビルド（lint + esbuild によるバンドル）
pnpm run compile

# 全テスト実行（コンパイル後に VS Code テストランナーを起動）
pnpm run test

# ベンチマーク実行
pnpm run bench

# ウォッチモード（esbuild + tsc 型チェックを並列実行）
pnpm run watch

# lint のみ
pnpm run lint

# フォーマット
pnpm run fmt

# プロダクションビルド（公開用）
pnpm run package
```

テストは `@vscode/test-cli` 経由で VS Code Extension Development Host 内で実行される。`.vscode-test.mjs` を変更しない限り、特定のテストファイルだけを単独実行する方法はない。`src/test/` 以下の `*.test.ts` はすべて `dist/test/` にコンパイルされ、`test` ラベルでまとめて実行される。

## アーキテクチャ

VS Code 拡張機能（`main: ./dist/extension.js`）。`src/extension.ts` がエントリーポイントで、全サブシステムの配線と VS Code イベント購読を担う。

### サブシステム

**`src/gutter.ts`** — 診断結果をエディタのガターに SVG アイコンで表示するため、`TextEditorDecorationType` を error/warn/info/hint の 4 種類生成する。

**`src/diagnostic-line.ts`** — CSS の `after` 疑似要素デコレーションを使い、診断メッセージを行末にインライン表示する。デコレーションは `Map<Uri.path, ...>` で管理され、`updateSettings` 呼び出しのたびにデコレーターを再生成することで設定をホットリロードする。

**`src/comments.ts`** — 正規表現でコメントタグ（`TODO`, `FIXME`, `!`, `?`, `*`）をパースする。スキャン経路は 2 つ：`findSingleLineComments`（`//`・`#`・`--`・`<!--`・`/*` 対応）と `findBlockComments`/`findJSDocComments`（複数行の `/* */`・`/** */` 対応）。エクスポートされている `parseDocument` はサイドバーツリー用の簡易版（TODO/FIXME のみ有効）で、`createBetterComments` がユーザー設定に対応したフル機能版。

**`src/bookmark.ts`** — `workspaceState` に永続化するブックマークを管理する。`applyShift` は、ドキュメント編集（行の挿入・削除）に応じてブックマークの行番号を調整する純粋関数。ブックマークは `{ uri: string, line: number }` の形式で保存される。

**`src/markers-tree.ts`** — サイドバービュー（`inline-markers.markers`）の `TreeDataProvider`。トップレベルに **Bookmarks** と **TODO / FIXME** の 2 セクションを表示する。パネル非表示時は処理を遅延する（`_visible` フラグ + `_dirty` フラグ）。コメントデータは `commentCache: Map<uri, TagMatch[]>` にキャッシュし、ファイルの保存・リネーム・削除イベントで更新する。

**`src/configurations.ts`** — 5 つのタグキーに対応する静的な `DEFAULTS` レコード。

**`src/types.ts`** — 共有型定義：`CommentTagKey`、`Bookmark`、`LocalTagConfig`。

### `extension.ts` のデータフロー

1. エディタ変更・ドキュメント編集 → `scheduleUpdate(immediate?)` でデバウンス → `updateAll(editor)`
2. `updateAll` は `updateDiagnosticsOnly`（ガター + インライン行）と `better.analyzeDocument` + `better.showForDocument` の両方を呼ぶ
3. `onDidChangeDiagnostics` → `scheduleDiagnosticsUpdate` → `updateDiagnosticsOnly` のみ実行
4. ブックマーク変更時は `onBookmarksChanged` コールバック経由で `markersTreeProvider` に通知
5. `markersTreeProvider` はサイドバーが表示されたタイミングで遅延ロードする

### ビルド

`esbuild.js` が `src/extension.ts` → `dist/extension.js`（CJS 形式、`vscode` は external）にバンドルする。テストは `dist/test/**` にコンパイルされる。`--bench` フラグを渡すとベンチランナーをコンパイルする。

### リンター

`oxlint-tsgolint` プラグインを使った `oxlint`。設定は `.oxlintrc.json`。型認識ルールが有効になっている。ファイル名はケバブケース必須。

## コーディング規約

### class の禁止

`class` 構文の使用を禁止する。状態管理にはクロージャとオブジェクトリテラル（ファクトリ関数パターン）を用いること。

```typescript
// 禁止
class Foo {
  private bar: string;
  constructor(bar: string) {
    this.bar = bar;
  }
  getBar() {
    return this.bar;
  }
}

// 許可
function createFoo(bar: string) {
  return {
    getBar: () => bar,
  };
}
```

VS Code API が要求する場合（`TreeDataProvider` の実装など）は例外として `class` を使用してよい。
