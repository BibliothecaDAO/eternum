const TERRAIN_PRESENTATION_CONTRACT_VERSION = 2;
const MAX_PREPARED_CACHE_PAGES = 64;
const MAX_PRESENTED_PAGE_SLOTS = 16;

export const WORLDMAP_RESOURCE_GROWTH_TOLERANCE = Object.freeze({
  geometries: 2,
  textures: 1,
});

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const populatedString = (value) => typeof value === "string" && value.trim().length > 0;

/** Checks one live production-scene observation; unavailable evidence is never successful. */
export function evaluateWorldmapTerrainObservation(observation, expected) {
  const failures = [];
  const missing = [];
  if (!observation) return verdict([], ["production scene observation is unavailable"]);

  evaluateRuntimeHealth(observation, failures, missing);
  evaluateGameIdentity(observation.gameIdentity, expected, failures, missing);
  evaluateCameraTarget(observation.cameraTargetHex, expected.cameraTarget, missing);
  const backend = evaluateRenderer(observation.renderer, expected.rendererMode, missing);
  evaluateTerrainPresentation(observation, expected, backend, failures, missing);
  if (expected.resourcePolicy) {
    evaluateResourceState(observation.resourceState, expected.resourcePolicy, failures, missing);
  }

  return verdict(failures, missing);
}

function evaluateRuntimeHealth(observation, failures, missing) {
  if (observation.errors?.length) failures.push("browser reported runtime errors");
  if (observation.consoleErrors?.length) failures.push("browser console reported a worker, shader, or runtime error");
  if (!observation.canvasPresent) missing.push("game canvas is unavailable");
}

function evaluateGameIdentity(identity, expected, failures, missing) {
  if (expected.pathname && expected.pathname !== identity?.pathname) {
    failures.push("the active game route differs from the requested world");
  }
  if (!Number.isSafeInteger(identity?.gameId) || identity.gameId <= 0) {
    missing.push("active game id is unavailable");
  } else if (expected.gameId !== undefined && identity.gameId !== expected.gameId) {
    failures.push(`active game id ${identity.gameId} differs from requested game ${expected.gameId}`);
  }
  if (!populatedString(identity?.namespace)) missing.push("active game namespace is unavailable");
  if (!populatedString(identity?.worldAddress)) missing.push("active world address is unavailable");
  if (!populatedString(identity?.worldName)) missing.push("active world name is unavailable");
  else if (expected.worldName && identity.worldName !== expected.worldName) {
    failures.push(`active world ${identity.worldName} differs from requested world ${expected.worldName}`);
  }
  if (!(identity?.tileRows > 0)) missing.push("authoritative TileOpt rows are unavailable");
  if (!(identity?.structureRows > 0)) missing.push("authoritative Structure rows are unavailable");
}

function evaluateCameraTarget(observed, expected, missing) {
  if (!expected) return;
  if (!finite(observed?.col) || !finite(observed?.row)) {
    missing.push("camera target hex is unavailable");
    return;
  }
  if (observed.col !== expected.col || observed.row !== expected.row) {
    missing.push(
      `camera target ${observed.col},${observed.row} has not reached requested ${expected.col},${expected.row}`,
    );
  }
}

function evaluateRenderer(renderer, requestedMode, missing) {
  const expectedBackend = requestedMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback";
  if (!renderer?.activeMode) missing.push("renderer backend is unavailable");
  else if (renderer.activeMode !== expectedBackend) {
    missing.push(`requested ${expectedBackend}, observed ${renderer.activeMode}`);
  }
  return expectedBackend;
}

function evaluateTerrainPresentation(observation, expected, backend, failures, missing) {
  if (!(observation.renderDiagnostics?.gauges?.worldBiomeSurfaceInstances > 0)) {
    missing.push("no populated authoritative terrain was observed");
  }
  const presentation = observation.renderDiagnostics?.terrainPresentation;
  if (presentation?.contractVersion !== TERRAIN_PRESENTATION_CONTRACT_VERSION || !presentation.current) {
    missing.push(`version ${TERRAIN_PRESENTATION_CONTRACT_VERSION} terrain presentation diagnostics are unavailable`);
    return;
  }

  const current = presentation.current;
  evaluatePageCoverage(observation, current, failures, missing);
  evaluateRenderedFrame(current, backend, missing);
  evaluateMilestoneTiming(current, failures, missing);
  evaluatePresentationProgress(current, expected.previousRevision, missing);
}

function evaluatePageCoverage(observation, current, failures, missing) {
  const required = current.requestedPageKeys;
  const complete = current.completePageKeys;
  const targetKeys = resolveTargetPageKeys(observation);
  if (!sameStringSet(targetKeys, required)) {
    missing.push("the composed terrain does not cover the camera's complete visual window");
  }
  if (!isNonEmptyStringArray(required) || !Array.isArray(complete)) {
    missing.push("requested and complete page coverage is unavailable");
    return;
  }
  if (hasDuplicates(required) || hasDuplicates(complete)) failures.push("page coverage contains duplicate keys");
  if (required.length > MAX_PRESENTED_PAGE_SLOTS || complete.length > MAX_PRESENTED_PAGE_SLOTS) {
    failures.push(`page coverage exceeds the ${MAX_PRESENTED_PAGE_SLOTS}-page policy`);
  }
  if (!sameStringSet(required, complete) || !current.converged) {
    missing.push("requested terrain has not converged");
  }
  if (!populatedString(current.sceneId)) missing.push("terrain presentation scene identity is unavailable");
  if (!hasCompleteCoverage(current.coverage)) missing.push("geometry, props and fog are not all complete");
}

function resolveTargetPageKeys(observation) {
  if (isNonEmptyStringArray(observation.visualWindow?.pageKeys)) return observation.visualWindow.pageKeys;
  return observation.trace?.findLast((entry) => entry.event === "visual_window_resolved")?.details?.activePageKeys;
}

function evaluateRenderedFrame(current, backend, missing) {
  if (
    !finite(current.revision) ||
    current.windowFullyRenderedRevision !== current.revision ||
    !finite(current.windowFullyRenderedAtMs)
  ) {
    missing.push("no successful rendered frame is correlated with the current terrain revision");
  }
  if (current.windowFullyRenderedBackend !== backend) {
    missing.push("the completed window was not observed on the requested backend");
  }
}

function evaluateMilestoneTiming(current, failures, missing) {
  const milestones = [
    current.requestedAtMs,
    current.sourceReadyAtMs,
    current.firstCompletePageAtMs,
    current.windowCompleteAtMs,
    current.windowFullyRenderedAtMs,
  ];
  if (milestones.some((time) => !finite(time))) {
    missing.push("terrain milestone timing is incomplete");
    return;
  }
  if (milestones.some((time, index) => index > 0 && time < milestones[index - 1])) {
    failures.push("terrain milestone order is invalid");
  }
}

function evaluatePresentationProgress(current, previousRevision, missing) {
  if (previousRevision !== undefined && (!finite(previousRevision) || current.revision <= previousRevision)) {
    missing.push("camera movement did not produce a new terrain revision");
  }
}

function evaluateResourceState(resources, policy, failures, missing) {
  const values = [
    resources?.preparedCachePages,
    resources?.presentedPageSlots,
    resources?.geometries,
    resources?.textures,
  ];
  if (values.some((value) => !finite(value) || value < 0)) {
    missing.push("terrain cache, page-pool, or renderer resource measurements are unavailable");
    return;
  }
  if (resources.preparedCachePages > MAX_PREPARED_CACHE_PAGES) {
    failures.push(`prepared terrain cache exceeds ${MAX_PREPARED_CACHE_PAGES} pages`);
  }
  if (resources.presentedPageSlots > MAX_PRESENTED_PAGE_SLOTS) {
    failures.push(`presented terrain pool exceeds ${MAX_PRESENTED_PAGE_SLOTS} page slots`);
  }
  if (!policy.baseline) return;
  const tolerance = policy.tolerance ?? WORLDMAP_RESOURCE_GROWTH_TOLERANCE;
  if (resources.geometries > policy.baseline.geometries + tolerance.geometries) {
    failures.push("renderer geometry resources grew beyond the warm-loop tolerance");
  }
  if (resources.textures > policy.baseline.textures + tolerance.textures) {
    failures.push("renderer texture resources grew beyond the warm-loop tolerance");
  }
}

function sameStringSet(left, right) {
  return (
    isNonEmptyStringArray(left) &&
    isNonEmptyStringArray(right) &&
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(populatedString);
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

function hasCompleteCoverage(coverage) {
  return coverage?.geometry === true && coverage.fog === true && coverage.props === "uploaded";
}

function verdict(failures, missing) {
  return {
    status: failures.length ? "fail" : missing.length ? "inconclusive" : "pass",
    reasons: [...failures, ...missing],
  };
}

export function summarizeWorldmapTerrainVerification(results, options = {}) {
  const navigation = summarizeResults(results);
  const unperformed = options.notExercised ?? [];
  const fullAcceptanceReasons = [
    ...navigation.reasons,
    ...unperformed.map((scenario) => `required scenario not exercised: ${scenario}`),
  ];
  const fullAcceptanceStatus =
    navigation.status === "fail"
      ? "fail"
      : navigation.status !== "pass" || unperformed.length > 0
        ? "inconclusive"
        : "pass";
  return {
    exitCode: fullAcceptanceStatus === "pass" ? 0 : fullAcceptanceStatus === "fail" ? 1 : 2,
    fullAcceptance: { status: fullAcceptanceStatus, reasons: fullAcceptanceReasons },
    navigation,
    results,
    status: fullAcceptanceStatus,
  };
}

function summarizeResults(results) {
  const status = results.some((result) => result.status === "fail")
    ? "fail"
    : results.length === 0 || results.some((result) => result.status !== "pass")
      ? "inconclusive"
      : "pass";
  const reasons = results.flatMap((result) =>
    result.reasons.map((reason) => `${result.name ?? "scenario"}: ${reason}`),
  );
  return { status, reasons };
}
