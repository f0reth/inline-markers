import * as fs from "fs";
import * as path from "path";

import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });

    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      }
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    target: "node24",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "info",
    plugins: [esbuildProblemMatcherPlugin],
    treeShaking: true,
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }

  const testFiles = [];
  const testDir = "src/test";
  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      if (file.endsWith(".test.ts")) {
        testFiles.push(path.join(testDir, file));
      }
    }
  }

  if (!production && testFiles.length > 0) {
    const testCtx = await esbuild.context({
      entryPoints: testFiles,
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node24",
      outdir: "dist/test",
      external: ["vscode"],
      sourcemap: !production,
      logLevel: "info",
      plugins: [esbuildProblemMatcherPlugin],
    });

    if (watch) {
      await testCtx.watch();
    } else {
      await testCtx.rebuild();
      await testCtx.dispose();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
