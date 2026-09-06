import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REGRESSION_THRESHOLDS = Object.freeze({
  commitP95Ms: { absolute: 1, relative: 0.2 },
  motionP95Ms: { absolute: 1, relative: 0.15 },
  staticP95Ms: { absolute: 1, relative: 0.15 },
  triangles: { absolute: 100_000, relative: 0.15 },
});

export function compareTerrainPerformanceSummaries(baseline, candidate) {
  const reasons = [];
  const inconclusiveReasons = [];
  const comparisons = [];
  for (const candidateResult of candidate?.results ?? []) {
    const baselineResult = (baseline?.results ?? []).find(
      (result) => result.rendererMode === candidateResult.rendererMode && result.variant === candidateResult.variant,
    );
    if (!baselineResult?.snapshot || !candidateResult.snapshot) continue;
    if (baselineResult.snapshot.contractVersion !== 2 || candidateResult.snapshot.contractVersion !== 2) {
      inconclusiveReasons.push(
        `${candidateResult.rendererMode}/${candidateResult.variant}: matching contract version 2 snapshots are required`,
      );
      continue;
    }
    const comparison = compareScenario(baselineResult, candidateResult);
    if (!comparison) {
      inconclusiveReasons.push(
        `${candidateResult.rendererMode}/${candidateResult.variant}: comparison metrics are missing or non-finite`,
      );
      continue;
    }
    comparisons.push(comparison);
    for (const metric of comparison.metrics) {
      const threshold = REGRESSION_THRESHOLDS[metric.id];
      if (threshold && metric.delta > threshold.absolute && metric.relativeDelta > threshold.relative) {
        reasons.push(
          `${comparison.rendererMode}/${comparison.variant}: ${metric.id} regressed by ${metric.delta.toFixed(2)}`,
        );
      }
    }
  }
  if (comparisons.length === 0 && inconclusiveReasons.length === 0) {
    inconclusiveReasons.push("baseline and candidate contain no matching benchmark scenarios");
  }
  return {
    comparisons,
    ok: reasons.length === 0 && inconclusiveReasons.length === 0,
    reasons: [...reasons, ...inconclusiveReasons],
    status: reasons.length > 0 ? "fail" : inconclusiveReasons.length > 0 ? "inconclusive" : "pass",
  };
}

function compareScenario(baselineResult, candidateResult) {
  const baseline = baselineResult.snapshot;
  const candidate = candidateResult.snapshot;
  const sampleKeys = [
    "commitSamples",
    "firstCompletePageSamples",
    "firstRenderedFrameSamples",
    "queueWaitSamples",
    "windowConvergenceSamples",
    "workerBuildSamples",
  ];
  if (
    sampleKeys.some(
      (key) =>
        ![baseline.chunks[key], candidate.chunks[key]].every((value) => Number.isSafeInteger(value) && value > 0),
    )
  ) {
    return null;
  }
  const metrics = [
    metric("staticP95Ms", baseline.frames.static.p95Ms, candidate.frames.static.p95Ms),
    metric("motionP95Ms", baseline.frames.motion.p95Ms, candidate.frames.motion.p95Ms),
    metric("commitP95Ms", baseline.chunks.commitP95Ms, candidate.chunks.commitP95Ms),
    metric("firstCompletePageP95Ms", baseline.chunks.firstCompletePageP95Ms, candidate.chunks.firstCompletePageP95Ms),
    metric("windowConvergenceP95Ms", baseline.chunks.windowConvergenceP95Ms, candidate.chunks.windowConvergenceP95Ms),
    metric(
      "firstRenderedFrameP95Ms",
      baseline.chunks.firstRenderedFrameP95Ms,
      candidate.chunks.firstRenderedFrameP95Ms,
    ),
    metric("workerBuildP95Ms", baseline.chunks.workerBuildP95Ms, candidate.chunks.workerBuildP95Ms),
    metric("queueWaitP95Ms", baseline.chunks.queueWaitP95Ms, candidate.chunks.queueWaitP95Ms),
    metric("triangles", baseline.render.triangles, candidate.render.triangles),
    metric("propInstances", baseline.render.propInstances, candidate.render.propInstances),
    metric("drawCalls", baseline.render.drawCalls, candidate.render.drawCalls),
    metric("firstTerrainFrameMs", baseline.render.firstTerrainFrameMs, candidate.render.firstTerrainFrameMs),
  ];
  if (metrics.some((value) => value === null)) return null;
  return {
    metrics,
    rendererMode: candidateResult.rendererMode,
    variant: candidateResult.variant,
  };
}

function metric(id, baseline, candidate) {
  if (![baseline, candidate].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  const delta = candidate - baseline;
  return {
    baseline,
    candidate,
    delta,
    id,
    relativeDelta: baseline === 0 ? (delta > 0 ? Number.POSITIVE_INFINITY : 0) : delta / baseline,
  };
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function main(args) {
  const baselinePath = readOption(args, "--baseline");
  const candidatePath = readOption(args, "--candidate");
  const outputPath = readOption(args, "--output");
  if (!baselinePath || !candidatePath) throw new Error("Terrain comparison requires --baseline and --candidate");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
  const comparison = compareTerrainPerformanceSummaries(baseline, candidate);
  const output = `${JSON.stringify(comparison, null, 2)}\n`;
  if (outputPath) writeFileSync(outputPath, output);
  console.log(output.trim());
  if (!comparison.ok) process.exitCode = 1;
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) main(process.argv.slice(2));
