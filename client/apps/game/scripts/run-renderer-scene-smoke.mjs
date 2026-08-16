import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_CHAIN = "appchain";
const DEFAULT_SCENES = ["map", "hex"];
const REQUIRED_RENDERER_PARITY_FEATURES = new Set(["environmentIbl", "toneMappingControl", "bloom"]);
const VALID_SCENES = new Set(["map", "hex", "travel"]);
const DEFAULT_WAIT_MS = 20000;
const AGENT_BROWSER_RETRY_DELAY_MS = 2000;
const AGENT_BROWSER_RETRY_ATTEMPTS = 2;
const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
const RETRYABLE_AGENT_BROWSER_FAILURE_PATTERNS = [
  "CDP command timed out: Runtime.evaluate",
  "Failed to read: Resource temporarily unavailable",
  "daemon may be busy or unresponsive",
];
const CARTRIDGE_FACTORY_SQL_BASE_URLS = {
  mainnet: [`${DEFAULT_CARTRIDGE_API_BASE}/x/eternum-factory-mainnet/torii/sql`],
  sepolia: [`${DEFAULT_CARTRIDGE_API_BASE}/x/eternum-factory-sepolia/torii/sql`],
};
const WORLD_DISCOVERY_LIMIT = 200;
const WORLD_DISCOVERY_TIMEOUT_MS = 2500;

export const GLOW_REPRO_SCENES = ["map", "travel"];
export const GLOW_REPRO_TARGETS = [
  "Essence Rift / FragmentMine emissive structures",
  "Fast-travel accent surfaces",
  "World FX emissive icons",
];

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

export function buildSceneSmokeUrl({ baseUrl, chain = DEFAULT_CHAIN, rendererMode, scene, worldName }) {
  if (!worldName) {
    throw new Error("buildSceneSmokeUrl requires a worldName");
  }

  const url = new URL(baseUrl);
  url.pathname = `/play/${chain}/${encodeURIComponent(worldName)}/${scene}`;
  url.searchParams.set("col", "0");
  url.searchParams.set("row", "0");
  url.searchParams.set("spectate", "true");
  url.searchParams.set("rendererMode", rendererMode);

  return url.toString();
}

export function decodePaddedWorldName(hex) {
  if (!hex || typeof hex !== "string") {
    return "";
  }

  const normalized = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  let index = 0;
  while (index + 1 < normalized.length && normalized.slice(index, index + 2) === "00") {
    index += 2;
  }

  let output = "";
  for (; index + 1 < normalized.length; index += 2) {
    const byte = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (!Number.isFinite(byte) || byte === 0) {
      continue;
    }
    output += String.fromCharCode(byte);
  }

  return output;
}

// The smoke targets the configured appchain world directly. Games live in
// that world's GameRegistry; the legacy factory deployment table is not part
// of the s2 indexer.
function resolveAppchainToriiBaseUrl(env = process.env) {
  return String(env.TORII_URL || env.VITE_PUBLIC_TORII || "").replace(/\/+$/, "");
}

function resolveFactorySqlBaseUrls(chain) {
  return CARTRIDGE_FACTORY_SQL_BASE_URLS[chain] ?? [];
}

function buildAppchainGameQueryUrl(toriiBaseUrl) {
  const url = new URL(`${toriiBaseUrl}/sql`);
  url.searchParams.set(
    "query",
    `SELECT registry.name
     FROM [s2-GameRegistry] registry
     INNER JOIN [s2-WorldConfig] config ON config.game_id = registry.game_id
     ORDER BY registry.game_id DESC
     LIMIT ${WORLD_DISCOVERY_LIMIT};`,
  );
  return url;
}

async function fetchAppchainGameNames(toriiBaseUrl) {
  const response = await fetch(buildAppchainGameQueryUrl(toriiBaseUrl), {
    signal: AbortSignal.timeout(WORLD_DISCOVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Appchain game discovery failed: ${response.status} ${response.statusText}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => decodePaddedWorldName(row?.name)).filter(Boolean);
}

function buildFactoryWorldQueryUrl(factorySqlBaseUrl) {
  const url = new URL(factorySqlBaseUrl);
  url.searchParams.set(
    "query",
    `SELECT name, address FROM [wf-WorldDeployed] ORDER BY internal_created_at DESC LIMIT ${WORLD_DISCOVERY_LIMIT};`,
  );
  return url;
}

async function fetchCandidateWorlds(factorySqlBaseUrl) {
  const response = await fetch(buildFactoryWorldQueryUrl(factorySqlBaseUrl), {
    signal: AbortSignal.timeout(WORLD_DISCOVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Factory world discovery failed: ${response.status} ${response.statusText}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return [];
  }

  const seenNames = new Set();
  const worlds = [];
  for (const row of rows) {
    const decodedName = decodePaddedWorldName(row?.name);
    if (!decodedName || seenNames.has(decodedName)) {
      continue;
    }

    seenNames.add(decodedName);
    worlds.push({ address: typeof row?.address === "string" ? row.address : "", name: decodedName });
  }

  return worlds;
}

// Cartridge chains give every world its own torii, so alive = it responds.
async function isCartridgeWorldAlive(worldName) {
  const probeUrl = new URL(`${DEFAULT_CARTRIDGE_API_BASE}/x/${encodeURIComponent(worldName)}/torii/sql`);
  probeUrl.searchParams.set("query", "SELECT 1 AS ok LIMIT 1;");

  try {
    const response = await fetch(probeUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(WORLD_DISCOVERY_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveAppchainSceneSmokeGameName() {
  const toriiBaseUrl = resolveAppchainToriiBaseUrl();
  if (!toriiBaseUrl) {
    throw new Error(
      "No appchain torii configured for world discovery: set TORII_URL or VITE_PUBLIC_TORII, or pass --world.",
    );
  }

  const [latestConfiguredGame] = await fetchAppchainGameNames(toriiBaseUrl);
  if (latestConfiguredGame) {
    return latestConfiguredGame;
  }

  throw new Error('No live world found for chain "appchain": pass --world to target one explicitly.');
}

async function resolveCartridgeSceneSmokeWorldName(chain) {
  const factorySqlBaseUrls = resolveFactorySqlBaseUrls(chain);
  if (factorySqlBaseUrls.length === 0) {
    throw new Error(`No factory configured for chain "${chain}": pass --world to target one explicitly.`);
  }

  for (const factorySqlBaseUrl of factorySqlBaseUrls) {
    const candidates = await fetchCandidateWorlds(factorySqlBaseUrl);

    for (const world of candidates) {
      if (await isCartridgeWorldAlive(world.name)) {
        return world.name;
      }
    }
  }

  throw new Error(`No live world found for chain "${chain}": pass --world to target one explicitly.`);
}

export async function resolveSceneSmokeWorldName({ chain, requestedWorldName }) {
  if (requestedWorldName) {
    return requestedWorldName;
  }

  return chain === "appchain" ? resolveAppchainSceneSmokeGameName() : resolveCartridgeSceneSmokeWorldName(chain);
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

export function normalizeRendererDiagnosticsSnapshot(snapshot) {
  return {
    activeMode: snapshot?.activeMode ?? null,
    buildMode: snapshot?.buildMode ?? null,
    capabilities: snapshot?.capabilities ?? null,
    degradations: Array.isArray(snapshot?.degradations) ? snapshot.degradations : [],
    effectPlan: snapshot?.effectPlan ?? null,
    fallbackReason: snapshot?.fallbackReason ?? null,
    fallbacks: snapshot?.fallbacks ?? 0,
    initErrors: snapshot?.initErrors ?? 0,
    initTimeMs: snapshot?.initTimeMs ?? null,
    postprocessPolicy: snapshot?.postprocessPolicy ?? null,
    requestedMode: snapshot?.requestedMode ?? null,
    sceneName: snapshot?.sceneName ?? null,
    startupTimings: snapshot?.startupTimings ?? {},
  };
}

export function evaluateRendererParitySummary(diagnosticsSnapshot) {
  const diagnostics = normalizeRendererDiagnosticsSnapshot(diagnosticsSnapshot);
  const blocking = diagnostics.degradations.filter((degradation) =>
    REQUIRED_RENDERER_PARITY_FEATURES.has(degradation.feature),
  );
  const advisory = diagnostics.degradations.filter(
    (degradation) => !REQUIRED_RENDERER_PARITY_FEATURES.has(degradation.feature),
  );

  return {
    advisory,
    blocking,
    ok: blocking.length === 0,
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

export function resolveAgentBrowserWorkingDirectory(env = process.env) {
  return env.RUNNER_TEMP || env.TMPDIR || tmpdir();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function invokeAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const baseArgs = ["-y", "agent-browser", "--session", session];
  if (headed) {
    baseArgs.push("--headed");
  }

  return spawnSync("npx", [...baseArgs, ...commandArgs], {
    cwd: resolveAgentBrowserWorkingDirectory(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const result = invokeAgentBrowser(session, commandArgs, { headed });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `agent-browser failed for session ${session}`);
  }

  return result.stdout.trim();
}

export function isRetryableAgentBrowserFailure({ commandArgs, stderr = "", stdout = "" }) {
  if (!isRetryableAgentBrowserCommand(commandArgs)) {
    return false;
  }

  return isRetryableAgentBrowserOutput(`${stderr}\n${stdout}`);
}

function isRetryableAgentBrowserCommand(commandArgs) {
  if (commandArgs[0] === "eval" || commandArgs[0] === "errors") {
    return true;
  }

  return commandArgs[0] === "get" && ["count", "url"].includes(commandArgs[1]);
}

function isRetryableAgentBrowserOutput(output) {
  return RETRYABLE_AGENT_BROWSER_FAILURE_PATTERNS.some((pattern) => output.includes(pattern));
}

async function runAgentBrowserWithRetries(
  session,
  commandArgs,
  { headed = false, retryAttempts = AGENT_BROWSER_RETRY_ATTEMPTS, retryDelayMs = AGENT_BROWSER_RETRY_DELAY_MS } = {},
) {
  let lastOutput = "";

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const result = invokeAgentBrowser(session, commandArgs, { headed });
    if (result.status === 0) {
      return (result.stdout ?? "").trim();
    }

    const stdout = (result.stdout ?? "").trim();
    const stderr = (result.stderr ?? "").trim();
    lastOutput = stderr || stdout || `agent-browser failed for session ${session}`;

    if (
      attempt === retryAttempts ||
      !isRetryableAgentBrowserFailure({
        commandArgs,
        stderr,
        stdout,
      })
    ) {
      throw new Error(lastOutput);
    }

    await sleep(retryDelayMs * (attempt + 1));
  }

  throw new Error(lastOutput);
}

function tryRunAgentBrowser(session, commandArgs, { headed = false } = {}) {
  const result = invokeAgentBrowser(session, commandArgs, { headed });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function truncateForLog(value, limit = 4000) {
  if (!value) {
    return "";
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n…[truncated ${value.length - limit} chars]`;
}

function ensureArtifactDir(artifactDir) {
  if (!artifactDir) {
    return null;
  }
  mkdirSync(artifactDir, { recursive: true });
  return artifactDir;
}

function dumpSceneSmokeFailureDiagnostics({ artifactDir, headed, rendererMode, scene, session }) {
  const slug = `${scene}-${rendererMode.replace(/[^a-z0-9-]/gi, "-")}`;
  const consoleLog = tryRunAgentBrowser(session, ["console"], { headed });
  const errorsLog = tryRunAgentBrowser(session, ["errors"], { headed });
  const htmlDump = tryRunAgentBrowser(session, ["get", "html"], { headed });
  const screenshotPath = artifactDir ? join(artifactDir, `${slug}.png`) : null;
  const screenshotResult = screenshotPath
    ? tryRunAgentBrowser(session, ["screenshot", screenshotPath], { headed })
    : { ok: false, stdout: "", stderr: "skipped (no --artifact-dir)" };

  process.stderr.write(`\n=== scene-smoke failure diagnostics: ${slug} ===\n`);
  process.stderr.write(`--- console ---\n${truncateForLog(consoleLog.stdout || consoleLog.stderr)}\n`);
  process.stderr.write(`--- errors ---\n${truncateForLog(errorsLog.stdout || errorsLog.stderr)}\n`);
  process.stderr.write(`--- html ---\n${truncateForLog(htmlDump.stdout)}\n`);
  if (screenshotPath) {
    process.stderr.write(
      `--- screenshot ---\n${screenshotResult.ok ? screenshotPath : screenshotResult.stderr || "failed"}\n`,
    );
  }

  if (artifactDir) {
    try {
      writeFileSync(join(artifactDir, `${slug}.console.log`), consoleLog.stdout || consoleLog.stderr || "");
      writeFileSync(join(artifactDir, `${slug}.errors.log`), errorsLog.stdout || errorsLog.stderr || "");
      writeFileSync(join(artifactDir, `${slug}.html`), htmlDump.stdout || "");
    } catch (writeError) {
      process.stderr.write(`[scene-smoke] failed to persist diagnostics: ${writeError?.message ?? writeError}\n`);
    }
  }
}

async function runSceneSmoke({
  artifactDir,
  baseUrl,
  chain,
  headed,
  rendererMode,
  scene,
  sessionToken,
  waitMs,
  worldName,
}) {
  const session = `renderer-smoke-${scene}-${rendererMode.replace(/[^a-z0-9-]/gi, "-")}-${sessionToken}`;
  const url = buildSceneSmokeUrl({ baseUrl, chain, rendererMode, scene, worldName });

  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed });
  await sleep(waitMs);

  const openedUrl = await runAgentBrowserWithRetries(session, ["get", "url"], { headed });
  const canvasExists =
    (await runAgentBrowserWithRetries(session, ["eval", "Boolean(document.getElementById('main-canvas'))"], {
      headed,
    })) === "true";
  const diagnostics = normalizeRendererDiagnosticsSnapshot(
    JSON.parse(
      (await runAgentBrowserWithRetries(session, ["eval", "JSON.stringify(window.__rendererDiagnostics ?? null)"], {
        headed,
      })) || "null",
    ),
  );
  const unableToStartCount = Number(
    (await runAgentBrowserWithRetries(session, ["get", "count", "text=Unable to Start"], { headed })) || "0",
  );
  const errors = parseErrorLines(await runAgentBrowserWithRetries(session, ["errors"], { headed }));
  const parity = evaluateRendererParitySummary(diagnostics);

  const evaluation = evaluateSceneSmokeResult({
    canvasExists,
    errors,
    expectedPathname: `/play/${chain}/${encodeURIComponent(worldName)}/${scene}`,
    openedUrl,
    unableToStartCount,
  });

  if (!evaluation.ok) {
    dumpSceneSmokeFailureDiagnostics({ artifactDir, headed, rendererMode, scene, session });
  }

  return {
    ...evaluation,
    canvasExists,
    diagnostics,
    errors,
    openedUrl,
    parity,
    rendererMode,
    scene,
    session,
    unableToStartCount,
    url,
  };
}

async function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const chain = readOption(argv, "--chain", DEFAULT_CHAIN);
  const rendererMode = readOption(argv, "--renderer-mode", "webgpu-auto");
  const scenes = normalizeSceneList(readOption(argv, "--scenes", ""));
  const waitMs = Number(readOption(argv, "--wait-ms", String(DEFAULT_WAIT_MS)));
  const requestedWorldName = readOption(argv, "--world", "");
  const headed = readFlag(argv, "--headed");
  const artifactDir = ensureArtifactDir(readOption(argv, "--artifact-dir", ""));
  const worldName = await resolveSceneSmokeWorldName({ chain, requestedWorldName });
  const sessionToken = Date.now().toString(36);

  const results = [];
  for (const scene of scenes) {
    results.push(
      await runSceneSmoke({
        artifactDir,
        baseUrl,
        chain,
        headed,
        rendererMode,
        scene,
        sessionToken,
        waitMs,
        worldName,
      }),
    );
  }

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  await main(process.argv.slice(2));
}
