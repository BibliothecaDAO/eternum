export const TERRAIN_BENCHMARK_RENDERERS = Object.freeze(["webgpu-auto", "webgpu-force-webgl"]);
export const TERRAIN_BENCHMARK_VARIANTS = Object.freeze(["geometry", "material", "props", "production"]);

export function evaluateTerrainPerformanceResults(results, options = {}) {
  const requiredRenderers = options.renderers ?? TERRAIN_BENCHMARK_RENDERERS;
  const requiredVariants = options.variants ?? TERRAIN_BENCHMARK_VARIANTS;
  const requireLifecycle = options.runMode === "full";
  const enforceTiming = options.timingPolicy !== "informational";
  const reasons = [];

  for (const rendererMode of requiredRenderers) {
    for (const variant of requiredVariants) {
      if (!results.some((result) => result.rendererMode === rendererMode && result.variant === variant)) {
        reasons.push(`${rendererMode}/${variant}: missing benchmark scenario`);
      }
    }
  }

  for (const result of results) evaluateScenario(result, requireLifecycle, enforceTiming, reasons);
  evaluateBackendParity(results, reasons);

  return {
    ok: reasons.length === 0,
    optimizationDeltas: createOptimizationDeltas(results),
    reasons,
  };
}

function evaluateScenario(result, requireLifecycle, enforceTiming, reasons) {
  const label = `${result.rendererMode}/${result.variant}`;
  const snapshot = result.snapshot;
  if (!result.routeMounted) reasons.push(`${label}: benchmark route did not mount`);
  if (!result.complete) reasons.push(`${label}: benchmark did not complete`);
  if (result.errors.length > 0) reasons.push(`${label}: browser reported ${result.errors[0]}`);
  if (!snapshot) {
    reasons.push(`${label}: benchmark snapshot is missing`);
    return;
  }
  if (snapshot.contractVersion !== 1) reasons.push(`${label}: expected contract version 1`);
  if (snapshot.fixture?.fingerprint !== "fullscreen-balanced-v2") {
    reasons.push(`${label}: fixture fingerprint did not match fullscreen-balanced-v2`);
  }
  if (snapshot.fixture?.pageCount !== 144)
    reasons.push(`${label}: expected 144 pages including the coverage guard band`);
  if (snapshot.fixture?.visiblePageCount !== 12) reasons.push(`${label}: expected twelve visible pages`);
  if (snapshot.fixture?.cellCount !== 82_944) reasons.push(`${label}: expected 82,944 fixture cells`);
  if (!(snapshot.coverage?.checks >= 10)) reasons.push(`${label}: insufficient full-screen coverage checks`);
  if (snapshot.coverage?.missingFrames !== 0 || snapshot.coverage?.missingSamples !== 0) {
    reasons.push(`${label}: terrain did not cover every sampled screen position`);
  }
  if (enforceTiming) {
    evaluateFrameStats(label, "static", snapshot.frames?.static, 20, reasons);
    evaluateFrameStats(label, "motion", snapshot.frames?.motion, 25, reasons);
    if (!(snapshot.chunks?.commitP95Ms >= 0 && snapshot.chunks.commitP95Ms <= 8)) {
      reasons.push(`${label}: page commit p95 exceeded 8 ms`);
    }
    if (!(snapshot.render?.firstRenderMs >= 0 && snapshot.render.firstRenderMs <= 500)) {
      reasons.push(`${label}: first terrain render exceeded 500 ms`);
    }
    if (snapshot.longTasks?.maxMs >= 50) reasons.push(`${label}: terrain-attributed long task reached 50 ms`);
  }
  if (!(snapshot.render?.drawCalls > 0 && snapshot.render.drawCalls <= 40)) {
    reasons.push(`${label}: draw calls exceeded 40 or were unavailable`);
  }
  if (!(snapshot.render?.triangles > 0 && snapshot.render.triangles < 5_250_000)) {
    reasons.push(`${label}: rendered triangles exceeded the measured 5.25M close-view budget`);
  }
  if (!(snapshot.render?.textures >= 0 && snapshot.render.textures <= 32)) {
    reasons.push(`${label}: renderer texture count exceeded 32 or was unavailable`);
  }
  evaluateAssetRequests(label, result.variant, snapshot.assets, reasons);
  if ((result.variant === "props" || result.variant === "production") && !(snapshot.render?.propInstances > 0)) {
    reasons.push(`${label}: expected rendered prop instances`);
  }
  if (requireLifecycle) {
    if (snapshot.chunks?.lifecyclePagesVisited !== 100) reasons.push(`${label}: lifecycle did not visit 100 pages`);
    if (snapshot.lifecycle?.geometryGrowth > 0 || snapshot.lifecycle?.textureGrowth > 0) {
      reasons.push(`${label}: renderer resources grew after returning to origin`);
    }
  }
}

function evaluateFrameStats(label, phase, stats, p95BudgetMs, reasons) {
  if (!(stats?.sampleCount >= 100)) reasons.push(`${label}: ${phase} frame sample count was below 100`);
  if (!(stats?.p95Ms > 0 && stats.p95Ms <= p95BudgetMs)) {
    reasons.push(`${label}: ${phase} frame p95 exceeded ${p95BudgetMs} ms`);
  }
  if (!(stats?.p99Ms > 0 && stats.p99Ms <= 33.3)) reasons.push(`${label}: ${phase} frame p99 exceeded 33.3 ms`);
  if (stats?.above50Ms > 0) reasons.push(`${label}: ${phase} trace contained a frame at or above 50 ms`);
}

function evaluateAssetRequests(label, variant, assets, reasons) {
  const expectsGround = variant !== "geometry";
  const expectsProps = variant === "props" || variant === "production";
  if (assets?.groundArrayRequests !== (expectsGround ? 2 : 0)) {
    reasons.push(`${label}: ground arrays did not load exactly ${expectsGround ? "once each" : "zero times"}`);
  }
  if (assets?.propCatalogRequests !== (expectsProps ? 1 : 0)) {
    reasons.push(`${label}: prop catalog request count did not match the variant`);
  }
}

function evaluateBackendParity(results, reasons) {
  for (const variant of TERRAIN_BENCHMARK_VARIANTS) {
    const metrics = results
      .filter((result) => result.variant === variant)
      .map((result) => result.snapshot)
      .filter(Boolean);
    if (metrics.length < 2) continue;
    const reference = metrics[0];
    if (
      metrics.some(
        (metric) =>
          metric.fixture.fingerprint !== reference.fixture.fingerprint ||
          metric.fixture.visiblePageCount !== reference.fixture.visiblePageCount ||
          metric.render.propInstances !== reference.render.propInstances,
      )
    ) {
      reasons.push(`${variant}: renderer backends produced different fixture or prop counts`);
    }
  }
}

function createOptimizationDeltas(results) {
  return TERRAIN_BENCHMARK_RENDERERS.flatMap((rendererMode) => {
    const byVariant = Object.fromEntries(
      results
        .filter((result) => result.rendererMode === rendererMode)
        .map((result) => [result.variant, result.snapshot]),
    );
    return pairwise(TERRAIN_BENCHMARK_VARIANTS).flatMap(([baselineVariant, candidateVariant]) => {
      const baseline = byVariant[baselineVariant];
      const candidate = byVariant[candidateVariant];
      if (!baseline || !candidate) return [];
      return [
        {
          candidateVariant,
          drawCalls: candidate.render.drawCalls - baseline.render.drawCalls,
          motionP95Ms: candidate.frames.motion.p95Ms - baseline.frames.motion.p95Ms,
          rendererMode,
          staticP95Ms: candidate.frames.static.p95Ms - baseline.frames.static.p95Ms,
          triangles: candidate.render.triangles - baseline.render.triangles,
          baselineVariant,
        },
      ];
    });
  });
}

function pairwise(values) {
  return values.slice(1).map((value, index) => [values[index], value]);
}
