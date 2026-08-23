import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseAgentBrowserJson, runAgentBrowser } from "./run-renderer-debug-smoke.mjs";

const CHARACTER_GYM_PATH = "/debug/procedural-characters";
const DEFAULT_BASE_URL = "https://127.0.0.1:4173";
const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const VALID_KINDS = new Set(["archer", "crossbowman", "horse", "knight", "paladin"]);
const VALID_OVERLAYS = new Set(["clean", "diagnostic"]);
const VALID_SAMPLING = new Set(["all-frames", "key-phases", "phase-atlas"]);
const VALID_SEQUENCES = new Set(["archer-shot", "locomotion-cycle", "melee-attack"]);
const VALID_MOTION_MODES = new Set(["idle", "walk", "run", "mounted"]);
const ASSET_WEAPON_IDS = new Set(["winter-broadaxe", "winter-rider-battleaxe"]);
const ASSET_OFFHAND_IDS = new Set(["light-cavalry-shield", "winter-rider-shield", "winter-targe"]);
const CRITICAL_ISSUES = [
  "arrow-intersects-head",
  "bend-inverted",
  "elbow-hyperextended",
  "elbow-overfolded",
  "hand-inside-head",
  "grip-detached",
  "non-finite-joint",
  "palm-outward",
  "phase-mismatch",
  "solver-socket-diverged",
  "weapon-intersects-head",
  "weapon-intersects-offhand",
];

export function buildCharacterAnimationCaptureUrl({ baseUrl, rendererMode }) {
  const url = new URL(baseUrl);
  url.pathname = CHARACTER_GYM_PATH;
  url.search = "";
  if (rendererMode) url.searchParams.set("rendererMode", rendererMode);
  return url.toString();
}

export function normalizeCaptureKind(value) {
  if (!VALID_KINDS.has(value)) throw new Error(`Unsupported capture kind "${value}"`);
  return value;
}

export function normalizeCaptureSampling(value) {
  if (!VALID_SAMPLING.has(value)) throw new Error(`Unsupported capture sampling "${value}"`);
  return value;
}

export function normalizeCaptureOverlay(value) {
  if (!VALID_OVERLAYS.has(value)) throw new Error(`Unsupported capture overlay "${value}"`);
  return value;
}

export function normalizeCaptureSequence(value) {
  if (!VALID_SEQUENCES.has(value)) throw new Error(`Unsupported capture sequence "${value}"`);
  return value;
}

export function normalizeCaptureMotionMode(value) {
  if (!VALID_MOTION_MODES.has(value)) throw new Error(`Unsupported capture motion mode "${value}"`);
  return value;
}

export function resolveCaptureMotionMode(kind, requestedMode) {
  if (kind === "paladin") {
    if (requestedMode && requestedMode !== "mounted") {
      throw new Error(`Mounted Paladin capture does not support motion mode "${requestedMode}"`);
    }
    return "mounted";
  }
  return normalizeCaptureMotionMode(requestedMode || (kind === "crossbowman" ? "walk" : "idle"));
}

export function normalizeRootMotionSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0) throw new Error(`Invalid root motion speed "${value}"`);
  return speed;
}

export function evaluateCharacterAnimationCapture({ browserErrors, report }) {
  const reasons = [];
  if (!report?.frames?.length) reasons.push("capture produced no frames");
  const blankViews = (report?.frames ?? []).flatMap((frame) =>
    (frame.views?.length ? frame.views : [{ id: "primary", imageNonBlank: frame.imageNonBlank }])
      .filter(({ imageNonBlank }) => !imageNonBlank)
      .map(({ id }) => `F${frame.frameIndex}:${id}`),
  );
  if (blankViews.length > 0) reasons.push(`blank frame views: ${blankViews.join(", ")}`);
  const criticalIssues = (report?.frames ?? []).flatMap(({ frameIndex, issues }) =>
    issues
      .filter((issue) => CRITICAL_ISSUES.some((critical) => issue.includes(critical)))
      .map((issue) => `F${frameIndex}:${issue}`),
  );
  if (criticalIssues.length > 0) reasons.push(`critical pose issues: ${criticalIssues.join(", ")}`);
  if (report?.evaluation?.locomotionHardGatePassed === false) {
    reasons.push(`locomotion hard gate: ${report.evaluation.locomotionHardGateFailures.join(", ")}`);
  }
  if (browserErrors.length > 0) reasons.push(`browser reported ${browserErrors.length} error(s): ${browserErrors[0]}`);
  return { ok: reasons.length === 0, reasons };
}

function readOption(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function readFlag(args, name) {
  return args.includes(name);
}

function parseErrorLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readGymSnapshot(session, headed) {
  return parseAgentBrowserJson(
    runAgentBrowser(
      session,
      [
        "eval",
        `JSON.stringify((() => ({
          config: window.__proceduralCharacterGym?.getConfig() ?? null,
          ready: document.querySelector('[data-debug-route="procedural-characters"]')?.getAttribute('data-gym-ready') === 'true',
          rendererMode: window.__proceduralCharacterGym?.getStats().rendererMode ?? null,
          stats: window.__proceduralCharacterGym?.getStats() ?? null,
        }))())`,
      ],
      { headed },
    ),
  );
}

function waitForGym({ headed, session, timeoutMs, until }) {
  const startTime = Date.now();
  let snapshot = readGymSnapshot(session, headed);
  while (!until(snapshot) && Date.now() - startTime < timeoutMs) {
    runAgentBrowser(session, ["wait", String(POLL_INTERVAL_MS)], { headed });
    snapshot = readGymSnapshot(session, headed);
  }
  if (!until(snapshot)) throw new Error(`Timed out waiting for the animation gym: ${JSON.stringify(snapshot)}`);
  return snapshot;
}

function configureCaptureUnit(session, headed, kind, motionMode, weaponId, offhandId) {
  runAgentBrowser(
    session,
    [
      "eval",
      `(() => {
        window.__proceduralCharacterGym.updateConfig({
          kind: ${JSON.stringify(kind)},
          archer: { autoFire: false },
          humanoid: { animationMode: ${JSON.stringify(motionMode)}, autoRotate: false },
          melee: {
            autoAttack: false,
            ...(${JSON.stringify(weaponId)} && { weaponId: ${JSON.stringify(weaponId)} }),
            ...(${JSON.stringify(offhandId)} && { offhandId: ${JSON.stringify(offhandId)} }),
          },
        });
        return "configured";
      })()`,
    ],
    { headed },
  );
}

function captureReport(session, headed, sampling, overlay, sequence, rootMotionSpeed) {
  const raw = runAgentBrowser(
    session,
    [
      "eval",
      `(async () => {
        await window.__proceduralCharacterGym.captureFrames(
          ${JSON.stringify(sampling)},
          ${JSON.stringify(overlay)},
          ${JSON.stringify({ sequence, rootMotionSpeed })}
        );
        return JSON.stringify(window.__proceduralCharacterGym.getFrameCaptureReport());
      })()`,
    ],
    { headed, timeoutMs: 120_000 },
  );
  return parseAgentBrowserJson(raw);
}

function writeCaptureArtifacts(session, headed, report, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "pose-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  report.frames.forEach(({ frameIndex, views }) => {
    (views?.length ? views : [{ id: null }]).forEach(({ id }) => {
      const viewArgument = id ? `, ${JSON.stringify(id)}` : "";
      const raw = runAgentBrowser(
        session,
        ["eval", `JSON.stringify(window.__proceduralCharacterGym.getCapturedFrameImage(${frameIndex}${viewArgument}))`],
        { headed },
      );
      const dataUrl = parseAgentBrowserJson(raw);
      if (typeof dataUrl !== "string" || !dataUrl.includes(",")) return;
      const filename = `frame-${String(frameIndex).padStart(4, "0")}-${id ?? "primary"}.webp`;
      writeFileSync(join(outputDir, filename), decodeDataUrl(dataUrl));
    });
  });
}

function decodeDataUrl(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

function runCapture({
  baseUrl,
  headed,
  kind,
  motionMode,
  offhandId,
  outputDir,
  overlay,
  rendererMode,
  rootMotionSpeed,
  sampling,
  sequence,
  timeoutMs,
  weaponId,
}) {
  const session = `character-animation-capture-${process.pid}`;
  const url = buildCharacterAnimationCaptureUrl({ baseUrl, rendererMode });
  runAgentBrowser(session, ["open", url, "--ignore-https-errors"], { headed, timeoutMs });
  try {
    const readySnapshot = waitForGym({
      headed,
      session,
      timeoutMs,
      until: ({ ready, rendererMode: activeMode }) => ready && activeMode !== "initializing",
    });
    configureCaptureUnit(session, headed, kind, motionMode, weaponId, offhandId);
    const configuredSnapshot = waitForGym({
      headed,
      session,
      timeoutMs,
      until: ({ config, stats }) =>
        config?.kind === kind &&
        config?.humanoid?.animationMode === motionMode &&
        (!weaponId || config?.melee?.weaponId === weaponId) &&
        (!offhandId || config?.melee?.offhandId === offhandId) &&
        (!ASSET_WEAPON_IDS.has(weaponId) || stats?.meleeWeaponSource === "asset") &&
        (!ASSET_OFFHAND_IDS.has(offhandId) || stats?.meleeOffhandSource === "asset"),
    });
    const report = captureReport(session, headed, sampling, overlay, sequence, rootMotionSpeed);
    writeCaptureArtifacts(session, headed, report, outputDir);
    const browserErrors = parseErrorLines(runAgentBrowser(session, ["errors"], { headed }));
    const evaluation = evaluateCharacterAnimationCapture({ browserErrors, report });
    return {
      ...evaluation,
      activeRendererMode: readySnapshot.rendererMode,
      browserErrors,
      capturedFrameCount: report.frames.length,
      capturedImageCount: report.frames.reduce((count, frame) => count + Math.max(1, frame.views?.length ?? 0), 0),
      issueCount: report.frames.reduce((count, frame) => count + frame.issues.length, 0),
      kind,
      motionMode,
      offhandId: configuredSnapshot.config?.melee?.offhandId,
      offhandSource: configuredSnapshot.stats?.meleeOffhandSource,
      outputDir,
      overlay,
      rootMotionSpeed: report.plan.rootMotionSpeed,
      sampling,
      sequence: report.plan.sequence,
      totalFrameCount: report.plan.totalFrames,
      url,
      weaponId: configuredSnapshot.config?.melee?.weaponId,
      weaponSource: configuredSnapshot.stats?.meleeWeaponSource,
    };
  } finally {
    runAgentBrowser(session, ["close"], { headed });
  }
}

function main(argv) {
  const baseUrl = readOption(argv, "--base-url", DEFAULT_BASE_URL);
  const headed = readFlag(argv, "--headed");
  const kind = normalizeCaptureKind(readOption(argv, "--kind", "archer"));
  const requestedMotionMode = readOption(argv, "--motion-mode", "");
  const motionMode = resolveCaptureMotionMode(kind, requestedMotionMode);
  const offhandId = readOption(argv, "--offhand-id", "");
  const rendererMode = readOption(argv, "--renderer-mode", "");
  const sampling = normalizeCaptureSampling(readOption(argv, "--sampling", "phase-atlas"));
  const requestedSequence = readOption(argv, "--sequence", "");
  const sequence = requestedSequence
    ? normalizeCaptureSequence(requestedSequence)
    : requestedMotionMode
      ? "locomotion-cycle"
      : undefined;
  const weaponId = readOption(argv, "--weapon-id", "");
  const overlay = normalizeCaptureOverlay(
    readOption(argv, "--overlay", sampling === "phase-atlas" ? "diagnostic" : "clean"),
  );
  const timeoutMs = Number(readOption(argv, "--timeout-ms", String(DEFAULT_TIMEOUT_MS)));
  const requestedRootMotionSpeed = readOption(argv, "--root-motion-speed", "");
  const rootMotionSpeed = requestedRootMotionSpeed ? normalizeRootMotionSpeed(requestedRootMotionSpeed) : undefined;
  const outputDir = resolve(
    readOption(argv, "--output-dir", resolve(process.cwd(), "../../../output/animation-capture", kind)),
  );
  const summary = runCapture({
    baseUrl,
    headed,
    kind,
    motionMode,
    offhandId,
    outputDir,
    overlay,
    rendererMode,
    rootMotionSpeed,
    sampling,
    sequence,
    timeoutMs,
    weaponId,
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
