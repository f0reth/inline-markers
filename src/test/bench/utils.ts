import * as fs from "node:fs";
import * as path from "node:path";

export interface BenchResult {
  label: string;
  avg: number;
  min: number;
  max: number;
  p95: number;
  iterations: number;
}

export async function measure(
  label: string,
  fn: () => Promise<void> | void,
  iterations = 100,
): Promise<BenchResult> {
  for (let i = 0; i < 10; i++) {
    await fn();
  }

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const [min] = times;
  const max = times[times.length - 1];
  const p95 = times[Math.floor(times.length * 0.95)];

  const result: BenchResult = { label, avg, min, max, p95, iterations };
  console.log(
    `[bench] ${label}: avg=${avg.toFixed(3)}ms min=${min.toFixed(3)}ms max=${max.toFixed(3)}ms p95=${p95.toFixed(3)}ms (${iterations} iters)`,
  );
  return result;
}

function buildMarkdown(results: BenchResult[]): string {
  const timestamp = new Date().toISOString();
  const header = `# Benchmark Results\n\n_Generated: ${timestamp}_\n\n`;
  const tableHeader =
    "| Label | avg (ms) | min (ms) | max (ms) | p95 (ms) | iters |\n" +
    "| --- | ---: | ---: | ---: | ---: | ---: |\n";
  const rows = results
    .map(
      (r) =>
        `| ${r.label} | ${r.avg.toFixed(3)} | ${r.min.toFixed(3)} | ${r.max.toFixed(3)} | ${r.p95.toFixed(3)} | ${r.iterations} |`,
    )
    .join("\n");
  return `${header}${tableHeader}${rows}\n`;
}

export function printResults(results: BenchResult[], name: string) {
  const COL = 52;
  console.log("\n=== Benchmark Results ===");
  console.log(
    `${"Label".padEnd(COL)} ${"avg(ms)".padStart(10)} ${"min(ms)".padStart(10)} ${"max(ms)".padStart(10)} ${"p95(ms)".padStart(10)}`,
  );
  console.log("-".repeat(COL + 44));
  for (const r of results) {
    console.log(
      `${r.label.padEnd(COL)} ${r.avg.toFixed(3).padStart(10)} ${r.min.toFixed(3).padStart(10)} ${r.max.toFixed(3).padStart(10)} ${r.p95.toFixed(3).padStart(10)}`,
    );
  }
  console.log("=".repeat(COL + 44));

  const projectRoot = path.resolve(__dirname, "../../..");
  const outDir = path.join(projectRoot, "bench-results");
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  const baseName = `${timestamp}-${name}`;

  if (process.env["BENCH_JSON"] === "1") {
    const outPath = path.join(outDir, `${baseName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n[bench] Results saved to ${outPath}`);
  }

  const md = buildMarkdown(results);
  const mdPath = path.join(outDir, `${baseName}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`[bench] Markdown results saved to ${mdPath}`);
}
