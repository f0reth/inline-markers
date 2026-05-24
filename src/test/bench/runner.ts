import { runActivationBench } from "./bench-activation";
import { runAllBench } from "./bench-all";
import { runCommentsBench } from "./bench-comments";
import { runDiagnosticLineBench } from "./bench-diagnostic-line";
import { runGutterBench } from "./bench-gutter";

suite("Benchmarks", function () {
  this.timeout(120000);

  test("activation", async () => {
    await runActivationBench();
  });
  test("comments", async () => {
    await runCommentsBench();
  });
  test("gutter", async () => {
    await runGutterBench();
  });
  test("diagnostic-line", async () => {
    await runDiagnosticLineBench();
  });
  test("all", async () => {
    await runAllBench();
  });
});
