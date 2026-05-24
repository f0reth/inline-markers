import { runActivationBench } from "./bench-activation";
import { runAllBench } from "./bench-all";
import { runCommentsBench } from "./bench-comments";
import { runDiagnosticLineBench } from "./bench-diagnostic-line";
import { runGutterBench } from "./bench-gutter";

export async function run() {
  await runActivationBench();
  await runCommentsBench();
  await runGutterBench();
  await runDiagnosticLineBench();
  await runAllBench();
}
