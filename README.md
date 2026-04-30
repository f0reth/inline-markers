# Inline Markers

A VS Code extension that enhances your coding experience with custom comment highlights, gutter icons, and inline diagnostic messages.

[日本語版は下](#日本語)

---

## Features

- **Custom Comment Highlights**: Color-coded highlights for `TODO`, `FIXME`, `!`, `?`, and `*`.
- **Diagnostic Gutter Icons**: Clearly see errors and warnings in the editor gutter.
- **Inline Diagnostic Messages**: Display error and warning messages directly at the end of the line.

## Usage

### Comment Tags

Simply write a comment with one of the supported tags at the beginning:

- `// TODO: Task to be done` (Orange)
- `// FIXME: Bug to be fixed` (Peach/Pink)
- `// ! Important note` (Red)
- `// ? Question or inquiry` (Blue)
- `// * Highlighted information` (Green)

Block comments are also supported:

```javascript
/*
 * TODO: Multiline tasks
 * ! Critical info
 */
```

### Diagnostics (Gutter & Inline)

The extension automatically listens to your language server (e.g., TypeScript, Python, ESLint) and displays issues as follows:

- **Gutter Icons**: Colored icons appear right next to the line numbers.
  - 🔴 Error, 🟡 Warning, 🔵 Info, ⚪ Hint
- **Inline Messages**: The actual error/warning message is displayed directly at the end of the line with a background color. This allows you to understand the problem instantly without hovering over the red squiggles.

## Configuration

You can customize the colors and visibility in VS Code Settings (`Ctrl+,`):

- `inline-markers.gutter.enabled`: Toggle gutter icons.
- `inline-markers.diagnosticLine.enabled`: Toggle inline messages.
- `inline-markers.diagnosticLine.errorLabelBg`: Customize the background color of error messages.
- `inline-markers.comments.fixme.color`: Change the FIXME tag color.

---

<a name="日本語"></a>

# Inline Markers (日本語)

カスタムコメントハイライト、ガーターアイコン、インライン診断メッセージでコーディングを快適にする VS Code 拡張機能です。

## 主な機能

- **カスタムコメントハイライト**: `TODO`, `FIXME`, `!`, `?`, `*` を色分けして強調表示します。
- **診断ガーターアイコン**: エラーや警告をエディタの横（ガーター）にアイコンで表示します。
- **インライン診断メッセージ**: エラーや警告のメッセージを、該当する行の末尾に直接表示します。

## 使用方法

### コメントタグ

コメントの先頭に以下のタグを記述するだけで反映されます：

- `// TODO: やることリスト` (オレンジ)
- `// FIXME: 修正が必要なバグ` (桃色)
- `// ! 重要な注意書き` (赤)
- `// ? 疑問点や問い合わせ` (青)
- `// * 強調したい情報` (緑)

ブロックコメントにも対応しています：

```javascript
/*
 * TODO: 複数行にわたるタスク
 * ! 非常に重要な情報
 */
```

### 診断表示 (ガーター & インライン)

TypeScript や ESLint などの言語サーバーから報告される問題を以下のように表示します：

- **ガーターアイコン**: 行番号のすぐ横に色付きのアイコンが表示されます。
  - 🔴 エラー, 🟡 警告, 🔵 情報, ⚪ ヒント
- **インラインメッセージ**: エラー内容が該当行の末尾に背景色付きで表示されます。波線の上にマウスを乗せなくても、コードを読みながら瞬時にエラー内容を把握できます。

## 設定

VS Code の設定画面 (`Ctrl+,`) から、表示のカスタマイズが可能です：

- `inline-markers.gutter.enabled`: ガーターアイコンの有効/無効。
- `inline-markers.diagnosticLine.enabled`: インラインメッセージの有効/無効。
- `inline-markers.diagnosticLine.errorLabelBg`: エラーメッセージの背景色の変更。
- `inline-markers.comments.fixme.color`: FIXME タグの色の変更。
