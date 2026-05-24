import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "test",
    files: "dist/test/**/*.test.js",
  },
  {
    label: "bench",
    files: "dist/test/bench/runner.js",
  },
]);
