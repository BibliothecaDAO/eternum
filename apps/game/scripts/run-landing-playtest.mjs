import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startClient } from "./client-playtest/client-server.mjs";
import { createRunOwner } from "./client-playtest/run-owner.mjs";
import { STEP_SETS } from "./client-playtest/steps.mjs";
import { allocateRunDirectory, LOAD_REFUSED_STATUS } from "./run-client-playtest.mjs";

export const LANDING_SCENARIOS = [
  "lab-supply-post",
  "lab-scouts",
  "lab-town",
  "lab-oath-slots",
  "lab-actions-oath-pick",
  "lab-actions-oath-replace",
  "lab-oath-vitriol",
  "lab-oath-decline",
  "lab-oath-pass-capped",
  "lab-oath-battle-target",
  "lab-oath-deep-battle-target",
  "lab-battle-target",
  "lab-deep-battle-target",
];

const VIEWPORTS = ["1920x1080", "390x844"];
const RENDERER_MODE = "webgpu-force-webgl";
const DEFAULT_PORT = 4188;
const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(SCRIPTS_DIR, "run-client-playtest.mjs");
const DEFAULT_OUT = resolve(SCRIPTS_DIR, "../../../.context/playtest");
const STOP_GRACE_MS = 5_000;

export function readLandingOptions(argv, callerDir = process.cwd()) {
  const named = [];
  let port = DEFAULT_PORT;
  let outRoot = DEFAULT_OUT;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--port") port = Number(argv[++index]);
    else if (argument === "--out") outRoot = resolve(callerDir, argv[++index]);
    else if (argument.startsWith("--"))
      throw new Error(`playtest:landing takes scenario names, --port and --out, not ${argument}`);
    else named.push(argument);
  }
  if (!Number.isInteger(port) || port < 1) throw new Error("--port must be a port number");
  const unknown = named.filter((scenario) => !STEP_SETS[scenario]);
  if (unknown.length > 0) throw new Error(`no playtest step list is named ${unknown.join(", ")}`);
  return { scenarios: named.length > 0 ? named : LANDING_SCENARIOS, port, outRoot };
}

export function judgeLanding(verdicts) {
  const failed = verdicts.filter(({ status }) => status !== 0);
  const failures = failed.map(({ scenario, viewport, status }) => `${scenario} at ${viewport} (exit ${status})`);
  if (failed.length === 0) return { failures, status: 0 };
  return { failures, status: failed.every(({ status }) => status === LOAD_REFUSED_STATUS) ? LOAD_REFUSED_STATUS : 1 };
}

async function main(argv) {
  const options = readLandingOptions(argv, process.env.INIT_CWD ?? process.cwd());
  const owner = createRunOwner();
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => owner.cancel(signal));
  const runDir = allocateRunDirectory(options.outRoot, "landing");
  const verdicts = [];
  let stopped = null;
  try {
    const client = await startClient({ owner, port: options.port, runDir });
    for (const scenario of options.scenarios) {
      for (const viewport of VIEWPORTS) {
        owner.throwIfCancelled();
        const out = join(runDir, scenario, viewport);
        verdicts.push({
          scenario,
          viewport,
          out,
          status: await playScenario({ owner, client, scenario, viewport, out }),
        });
      }
    }
  } catch (error) {
    stopped = error.message;
  } finally {
    await owner.releaseAll();
  }
  writeLandingVerdict({ options, runDir, stopped, verdicts });
}

function playScenario({ owner, client, scenario, viewport, out }) {
  const args = [RUNNER, "--base-url", client.baseUrl, "--steps", scenario, "--viewport", viewport];
  args.push("--iterations", "1", "--renderer-modes", RENDERER_MODE, "--out", out);
  const child = spawn(process.execPath, args, { stdio: "inherit" });
  const exited = new Promise((resolveExit) => child.once("exit", (code) => resolveExit(code ?? 1)));
  const stop = () => {
    if (child.exitCode !== null || child.signalCode !== null) return exited;
    const kill = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
    child.kill("SIGTERM");
    return exited.finally(() => clearTimeout(kill));
  };
  const release = owner.adopt(`playtest ${scenario} ${viewport}`, stop);
  const withdraw = owner.onCancel(() => void stop());
  return exited.finally(() => {
    withdraw();
    void release();
  });
}

function writeLandingVerdict({ options, runDir, stopped, verdicts }) {
  const judged = judgeLanding(verdicts);
  const failures = stopped ? [`stopped: ${stopped}`, ...judged.failures] : judged.failures;
  const status = stopped ? 1 : judged.status;
  const verdict = { scenarios: options.scenarios, viewports: VIEWPORTS, verdicts, failures, status };
  writeFileSync(join(runDir, "verdicts.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  console.log(JSON.stringify({ runDir, ok: status === 0, failures }, null, 2));
  process.exitCode = status;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
