#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseFlags, readJson, recordProviderOutput, requireFlag, writeJsonAtomic } from "./tripo-run-lib.mjs";

function runJson(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, {
    ...options,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? "unknown error";
    throw new Error(`${executable} ${argv[0]} failed with exit ${result.status}: ${detail}`);
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`${executable} ${argv[0]} returned invalid JSON: ${error.message}`);
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const runDirectory = path.resolve(requireFlag(flags, "--run-dir"));
  const approvedCreditCap = Number(requireFlag(flags, "--approved-credit-cap"));
  const manifestPath = path.join(runDirectory, "manifest.json");
  const requestPath = path.join(runDirectory, "request.json");
  const manifest = await readJson(manifestPath);
  const request = await readJson(requestPath);

  if (manifest.status !== "prepared") {
    throw new Error(
      `Run status is ${manifest.status}; refusing to submit. Recover existing tasks before creating another run.`,
    );
  }
  if (!Number.isSafeInteger(approvedCreditCap) || approvedCreditCap !== manifest.approval.creditCap) {
    throw new Error(`--approved-credit-cap must exactly match the prepared cap of ${manifest.approval.creditCap}`);
  }
  if (!request.command || !Array.isArray(request.command.argv)) {
    throw new Error("request.json does not contain a prepared command argument vector");
  }

  const executable = flags.get("--tripo") ?? request.command.executable ?? "tripo";
  const doctor = runJson(executable, ["doctor", "--json", "--no-open"]);
  if (doctor.ok !== true) {
    throw new Error("Tripo doctor did not pass; run tripo login and tripo doctor before spending credits");
  }
  const balanceBefore = runJson(executable, ["balance", "--json", "--no-open"]);
  const availableBalance = Number(balanceBefore.balance ?? balanceBefore.available ?? Number.NaN);
  if (Number.isFinite(availableBalance) && availableBalance < approvedCreditCap) {
    throw new Error(
      `Available balance ${availableBalance} is below the approved maximum run cost ${approvedCreditCap}`,
    );
  }

  manifest.status = "executing";
  manifest.updatedAt = new Date().toISOString();
  manifest.execution = {
    ...manifest.execution,
    status: "executing",
    startedAt: manifest.updatedAt,
    balanceBefore,
  };
  await writeJsonAtomic(manifestPath, manifest);

  const result = spawnSync(executable, request.command.argv, {
    cwd: runDirectory,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) {
    manifest.status = "execution-needs-recovery";
    manifest.updatedAt = new Date().toISOString();
    manifest.execution = {
      ...manifest.execution,
      status: manifest.status,
      exitCode: result.status,
      recovery: "Inspect tripo history and the existing task before any resubmission.",
    };
    await writeJsonAtomic(manifestPath, manifest);
    throw new Error(
      `Tripo exited ${result.status}. Do not resubmit blindly; inspect tripo history and recover the existing task.`,
    );
  }

  let providerResult;
  try {
    providerResult = JSON.parse(result.stdout.trim());
  } catch (error) {
    await writeFile(path.join(runDirectory, "provider-result.invalid.txt"), result.stdout, "utf8");
    manifest.status = "execution-needs-recovery";
    manifest.updatedAt = new Date().toISOString();
    manifest.execution = {
      ...manifest.execution,
      status: manifest.status,
      exitCode: result.status,
      rawResult: "provider-result.invalid.txt",
      recovery: "Inspect the raw result and tripo history before any resubmission.",
    };
    await writeJsonAtomic(manifestPath, manifest);
    throw new Error(`Tripo returned invalid final JSON: ${error.message}`);
  }
  let balanceAfter;
  try {
    balanceAfter = runJson(executable, ["balance", "--json", "--no-open"]);
  } catch (error) {
    balanceAfter = { unavailable: true, error: error.message };
  }
  const recordedManifest = await recordProviderOutput({
    runDirectory,
    result: providerResult,
    balanceAfter,
  });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      status: recordedManifest.status,
      runDirectory,
      taskIds: recordedManifest.execution.taskIds,
      creditsConsumed: recordedManifest.execution.creditsConsumed,
      artifacts: recordedManifest.execution.artifacts.length,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`execute-tripo-run: ${error.message}\n`);
  process.exitCode = 1;
});
