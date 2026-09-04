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
  const comparisons = [];
  for (const candidateResult of candidate?.results ?? []) {
    const baselineResult = (baseline?.results ?? []).find(
      (result) => result.rendererMode === candidateResult.rendererMode && result.variant === candidateResult.variant,
    );
    if (!baselineResult?.snapshot || !candidateResult.snapshot) continue;
    const comparison = compareScenario(baselineResult, candidateResult);
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
  if (comparisons.length === 0) reasons.push("baseline and candidate contain no matching benchmark scenarios");
  return { comparisons, ok: reasons.length === 0, reasons };
}

function compareScenario(baselineResult, candidateResult) {
  const baseline = baselineResult.snapshot;
  const candidate = candidateResult.snapshot;
  return {
    metrics: [
      metric("staticP95Ms", baseline.frames.static.p95Ms, candidate.frames.static.p95Ms),
      metric("motionP95Ms", baseline.frames.motion.p95Ms, candidate.frames.motion.p95Ms),
      metric("commitP95Ms", baseline.chunks.commitP95Ms, candidate.chunks.commitP95Ms),
      metric("triangles", baseline.render.triangles, candidate.render.triangles),
      metric("propInstances", baseline.render.propInstances, candidate.render.propInstances),
      metric("drawCalls", baseline.render.drawCalls, candidate.render.drawCalls),
      metric("firstRenderMs", baseline.render.firstRenderMs, candidate.render.firstRenderMs),
    ],
    rendererMode: candidateResult.rendererMode,
    variant: candidateResult.variant,
  };
}

function metric(id, baseline, candidate) {
  const delta = candidate - baseline;
  return {
    baseline,
    candidate,
    delta,
    id,
    relativeDelta: baseline === 0 ? 0 : delta / baseline,
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
