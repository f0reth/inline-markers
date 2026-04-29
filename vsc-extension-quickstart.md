# VS Code 拡張機能へようこそ

## フォルダ構成

- このフォルダには、拡張機能に必要なすべてのファイルが含まれています。
- `package.json` - 拡張機能とコマンドを宣言するマニフェストファイルです。
  - サンプルプラグインはコマンドを登録し、そのタイトルとコマンド名を定義しています。この情報により、VS Code はプラグインをロードする前にコマンドパレットにコマンドを表示できます。
- `src/extension.ts` - コマンドの実装を提供するメインファイルです。
  - このファイルは `activate` という関数をエクスポートしており、拡張機能が最初にアクティブ化されたとき（この場合はコマンドの実行時）に呼び出されます。`activate` 関数の中で `registerCommand` を呼び出します。
  - `registerCommand` の第2引数として、コマンドの実装を含む関数を渡します。

## セットアップ

- 推奨される拡張機能をインストールしてください（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner、dbaeumer.vscode-eslint）。

## すぐに実行する

- `F5` キーを押して、拡張機能がロードされた新しいウィンドウを開きます。
- コマンドパレット（Mac では `Ctrl+Shift+P` または `Cmd+Shift+P`）から `Hello World` と入力してコマンドを実行します。
- `src/extension.ts` 内のコードにブレークポイントを設定して、拡張機能をデバッグします。
- デバッグコンソールで拡張機能からの出力を確認できます。

## 変更を加える

- `src/extension.ts` のコードを変更した後、デバッグツールバーから拡張機能を再起動できます。
- また、ウィンドウの再読み込み（Mac では `Ctrl+R` または `Cmd+R`）を行って、変更を反映させることもできます。

## API を探索する

- `node_modules/@types/vscode/index.d.ts` ファイルを開くと、すべての API セットを確認できます。

## テストを実行する

- [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) をインストールします。
- **Tasks: Run Task** コマンドから "watch" タスクを実行します。これが実行されていないと、テストが検出されない場合があります。
- アクティビティバーから「テスト」ビューを開き、「テストの実行」ボタンをクリックするか、ショートカットキー `Ctrl/Cmd + ; A` を使用します。
- テスト結果の出力は「テスト結果」ビューで確認できます。
- `src/test/extension.test.ts` を変更するか、`test` フォルダ内に新しいテストファイルを作成します。
  - 提供されているテストランナーは、`**.test.ts` という名前に一致するファイルのみを対象とします。
  - `test` フォルダ内にフォルダを作成して、テストを自由に構造化できます。

## さらに詳しく

- [拡張機能のバンドル](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) を行うことで、拡張機能のサイズを削減し、起動時間を短縮できます。
- [VS Code 拡張機能マーケットプレイスへの公開](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) を検討してください。
- [継続的インテグレーション（CI）](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) を設定して、ビルドを自動化しましょう。
