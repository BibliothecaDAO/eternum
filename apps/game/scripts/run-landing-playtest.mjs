import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startClient } from "./client-playtest/client-server.mjs";
import { createRunOwner } from "./client-playtest/run-owner.mjs";
import { STEP_SETS } from "./client-playtest/steps.mjs";
import { allocateRunDirectory, LOAD_REFUSED_STATUS } from "./run-client-playtest.mjs";

export const LANDING_SCENARIOS = [
  "lab-oath-vitriol",
  "lab-supply-post",
  "lab-scouts",
  "lab-town",
  "lab-oath-slots",
  "lab-actions-oath-pick",
  "lab-actions-oath-replace",
  "lab-oath-decline",
  "lab-oath-pass-capped",
  "lab-oath-battle-target",
  "lab-oath-deep-battle-target",
  "lab-battle-target",
  "lab-deep-battle-target",
  "lab-realm-world",
  "lab-race",
  "lab-panels",
  "lab-hud-sheets",
];

const VIEWPORTS = ["1920x1080", "390x844"];
const SCENARIO_VIEWPORTS = {
  "lab-realm-world": ["1440x900", "1920x1080", "390x844"],
  "lab-hud-sheets": ["360x800", "390x844", "768x1024"],
};
const RENDERER_MODE = "webgpu-force-webgl";
const DEFAULT_PORT = 4188;
const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(SCRIPTS_DIR, "run-client-playtest.mjs");
const DEFAULT_OUT = resolve(SCRIPTS_DIR, "../../../.context/playtest");
const STOP_GRACE_MS = 5_000;
const CORES_PER_RUN = 4;

export const defaultWidth = (cores = availableParallelism()) => Math.max(1, Math.floor(cores / CORES_PER_RUN));

export function readLandingOptions(argv, callerDir = process.cwd()) {
  const named = [];
  let port = DEFAULT_PORT;
  let outRoot = DEFAULT_OUT;
  let width = defaultWidth();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--port") port = Number(argv[++index]);
    else if (argument === "--out") outRoot = resolve(callerDir, argv[++index]);
    else if (argument === "--width") width = Number(argv[++index]);
    else if (argument.startsWith("--"))
      throw new Error(`playtest:landing takes scenario names, --port, --out and --width, not ${argument}`);
    else named.push(argument);
  }
  if (!Number.isInteger(port) || port < 1) throw new Error("--port must be a port number");
  if (!Number.isInteger(width) || width < 1) throw new Error("--width must be a whole number of runs, at least 1");
  const unknown = named.filter((scenario) => !STEP_SETS[scenario]);
  if (unknown.length > 0) throw new Error(`no playtest step list is named ${unknown.join(", ")}`);
  return { scenarios: named.length > 0 ? named : LANDING_SCENARIOS, port, outRoot, width };
}

export const landingRuns = (scenarios, runDir) =>
  scenarios.flatMap((scenario) =>
    (SCENARIO_VIEWPORTS[scenario] ?? VIEWPORTS).map((viewport) => ({
      scenario,
      viewport,
      out: join(runDir, scenario, viewport),
    })),
  );

const playOnce = (play, run) =>
  Promise.resolve()
    .then(() => play(run))
    .catch((error) => {
      console.error(`${run.scenario} at ${run.viewport} did not play: ${error.message}`);
      return 1;
    });

export async function playEach(runs, width, play, shouldStop = () => false) {
  const verdicts = [];
  let next = 0;
  const lane = async () => {
    while (next < runs.length && !shouldStop()) {
      const index = next++;
      verdicts[index] = { ...runs[index], status: await playOnce(play, runs[index]) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, runs.length) }, lane));
  return verdicts.filter(Boolean);
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
  let verdicts = [];
  let stopped = null;
  try {
    const client = await startClient({ owner, port: options.port, runDir });
    const play = (run) => playScenario({ owner, client, ...run });
    verdicts = await playEach(landingRuns(options.scenarios, runDir), options.width, play, () => owner.cancelledBy);
    owner.throwIfCancelled();
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
  mkdirSync(out, { recursive: true });
  const log = openSync(join(out, "run.log"), "w");
  const startedAt = Date.now();
  const child = spawn(process.execPath, args, { stdio: ["ignore", log, log] });
  closeSync(log);
  const exited = new Promise((resolveExit) => child.once("exit", (code) => resolveExit(code ?? 1))).then((status) => {
    console.log(`${scenario} at ${viewport}: exit ${status} in ${Math.round((Date.now() - startedAt) / 1000)} s`);
    return status;
  });
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
  const verdict = {
    scenarios: options.scenarios,
    viewports: VIEWPORTS,
    width: options.width,
    verdicts,
    failures,
    status,
  };
  writeFileSync(join(runDir, "verdicts.json"), `${JSON.stringify(verdict, null, 2)}\n`);
  console.log(JSON.stringify({ runDir, ok: status === 0, failures }, null, 2));
  process.exitCode = status;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
