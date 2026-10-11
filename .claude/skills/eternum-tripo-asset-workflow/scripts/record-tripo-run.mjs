#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseFlags, readJson, recordProviderOutput, requireFlag } from "./tripo-run-lib.mjs";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const runDirectory = path.resolve(requireFlag(flags, "--run-dir"));
  const resultPath = path.join(runDirectory, "provider-result.json");
  const result = await readJson(resultPath);
  const manifest = await recordProviderOutput({ runDirectory, result });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      status: manifest.status,
      runDirectory,
      taskIds: manifest.execution.taskIds,
      creditsConsumed: manifest.execution.creditsConsumed,
      artifacts: manifest.execution.artifacts.length,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`record-tripo-run: ${error.message}\n`);
  process.exitCode = 1;
});
