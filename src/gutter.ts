import * as vscode from "vscode";

export function createGutterDecorators(context: Pick<vscode.ExtensionContext, "asAbsolutePath">) {
  const createDeco = (icon: string) =>
    vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath(`images/${icon}.svg`),
      gutterIconSize: "80%",
    });

  const errorGutter = createDeco("error");
  const warnGutter = createDeco("warn");
  const infoGutter = createDeco("info");
  const hintGutter = createDeco("hint");

  const disposables = [errorGutter, warnGutter, infoGutter, hintGutter];

  function dispose() {
    disposables.forEach((d) => {
      d.dispose();
    });
  }

  return {
    errorGutter,
    warnGutter,
    infoGutter,
    hintGutter,
    dispose,
  };
}
