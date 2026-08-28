import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { evaluateTerrainPerformanceResults } from "./terrain-performance-evaluator.mjs";

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function main(args) {
  const inputPath = readOption(args, "--input");
  const outputPath = readOption(args, "--output");
  if (!inputPath || !outputPath) throw new Error("Terrain re-evaluation requires --input and --output");
  const evidence = inputPath.split(",").map((path) => JSON.parse(readFileSync(path, "utf8")));
  const runModes = [...new Set(evidence.map(({ runMode }) => runMode))];
  if (runModes.length !== 1) throw new Error("Terrain evidence inputs must use the same run mode");
  const results = evidence.flatMap(({ results: inputResults }) => inputResults);
  const renderers = [...new Set(results.map(({ rendererMode }) => rendererMode))];
  const variants = [...new Set(results.map(({ variant }) => variant))];
  const evaluation = evaluateTerrainPerformanceResults(results, {
    renderers,
    runMode: runModes[0],
    variants,
  });
  const reevaluated = { ...evaluation, results, runMode: runModes[0] };
  writeFileSync(outputPath, `${JSON.stringify(reevaluated, null, 2)}\n`);
  console.log(JSON.stringify(reevaluated, null, 2));
  if (!reevaluated.ok) process.exitCode = 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) main(process.argv.slice(2));
