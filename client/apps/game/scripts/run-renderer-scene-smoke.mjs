import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_SCENES = ["map", "hex"];
const VALID_SCENES = new Set(["map", "hex", "travel"]);
const DEFAULT_WAIT_MS = 2500;

export function normalizeSceneList(value) {
  if (!value || value.trim().length === 0) {
    return [...DEFAULT_SCENES];
  }

  const scenes = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const scene of scenes) {
    if (!VALID_SCENES.has(scene)) {
      throw new Error(`Unsupported scene "${scene}". Expected one of: ${Array.from(VALID_SCENES).join(", ")}`);
    }
  }

  return scenes;
}

export function buildSceneSmokeUrl({ baseUrl, rendererMode, scene }) {
  const url = new URL(baseUrl);
  url.pathname = `/play/${scene}`;
  url.searchParams.set("col", "0");
  url.searchParams.set("row", "0");

  if (scene !== "hex") {
    url.searchParams.set("spectate", "true");
  }

  url.searchParams.set("rendererMode", rendererMode);

  return url.toString();
}

export function evaluateSceneSmokeResult({ canvasExists, errors, expectedPathname, openedUrl, unableToStartCount }) {
  const reasons = [];

  if (!openedUrl.includes(expectedPathname)) {
    reasons.push("landed on unexpected route");
  }

  if (!canvasExists) {
    reasons.push("main canvas was not present");
  }

  if (unableToStartCount > 0) {
    reasons.push('"Unable to Start" was visible');
  }

  if (errors.length > 0) {
    reasons.push("browser reported runtime errors");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function readFlag(args, name) {
  return args.includes(name);
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
}

function runAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const baseArgs = ["-y", "agent-browser", "--session", session];
  if (headed) {
    baseArgs.push("--headed");
  }

  const result = spawnSync("npx", [...baseArgs, ...commandArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser failed for session ${session}`);
  }

  return result.stdout.trim();
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runSceneSmoke({ baseUrl, headed, rendererMode, scene, waitMs }) {
  const session = `renderer-smoke-${scene}-${rendererMode.replace(/[^a-z0-9-]/gi, "-")}`;
  const url = buildSceneSmokeUrl({ baseUrl, rendererMode, scene });

  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed });
  runAgentBrowser(session, ["wait", String(waitMs)]);

  const openedUrl = runAgentBrowser(session, ["get", "url"]);
  const canvasExists = runAgentBrowser(session, ["eval", "Boolean(document.getElementById('main-canvas'))"]) === "true";
  const unableToStartCount = Number(runAgentBrowser(session, ["get", "count", "text=Unable to Start"]) || "0");
  const errors = parseErrorLines(runAgentBrowser(session, ["errors"]));

  const evaluation = evaluateSceneSmokeResult({
    canvasExists,
    errors,
    expectedPathname: `/play/${scene}`,
    openedUrl,
    unableToStartCount,
  });

  return {
    ...evaluation,
    canvasExists,
    errors,
    openedUrl,
    rendererMode,
    scene,
    session,
    unableToStartCount,
    url,
  };
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const rendererMode = readOption(argv, "--renderer-mode", "experimental-webgpu-auto");
  const scenes = normalizeSceneList(readOption(argv, "--scenes", ""));
  const waitMs = Number(readOption(argv, "--wait-ms", String(DEFAULT_WAIT_MS)));
  const headed = readFlag(argv, "--headed");

  const results = scenes.map((scene) =>
    runSceneSmoke({
      baseUrl,
      headed,
      rendererMode,
      scene,
      waitMs,
    }),
  );

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main(process.argv.slice(2));
}
