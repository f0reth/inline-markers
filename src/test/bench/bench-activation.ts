import * as vscode from "vscode";

export async function runActivationBench() {
  const ext = vscode.extensions.getExtension("f0reth.inline-markers")!;
  const result: unknown = await ext.activate();
  const raw: unknown =
    result !== null && typeof result === "object" && "activationDuration" in result
      ? Reflect.get(result as object, "activationDuration")
      : undefined;
  const duration = typeof raw === "number" ? raw : -1;
  console.log(`[bench] activation duration: ${duration.toFixed(3)} ms`);
}
