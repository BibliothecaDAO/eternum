/**
 * Cloudflare Worker example for Factory workflow dispatch without exposing a GitHub token to the client.
 *
 * Required secrets / vars:
 * - GITHUB_TOKEN
 * - GITHUB_REPOSITORY                e.g. "BibliothecaDAO/eternum"
 *
 * Optional vars:
 * - GITHUB_API_URL                   default: https://api.github.com
 * - GITHUB_USER_AGENT                default: realms-game-launch-worker
 * - GITHUB_WORKFLOW_FILE             default: game-launch.yml
 * - GITHUB_WORKFLOW_REF              default: next
 * - FACTORY_RUN_STORE_BRANCH         default: factory-runs
 * - FACTORY_ALLOWED_ORIGINS          comma-separated exact browser origins
 * - FACTORY_ROTATION_CONFIGS         comma-separated repo-relative rotation YAML paths
 */

const DEFAULT_FACTORY_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_FACTORY_SERIES_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_FACTORY_ROTATION_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES = 15;
const DEFAULT_FACTORY_RECENT_RUN_LIST_LIMIT = 50;
const MAX_FACTORY_RECENT_RUN_LIST_LIMIT = 100;
const FACTORY_WORKER_ADMIN_SECRET_HEADER = "x-factory-admin-secret";
const FACTORY_ENVIRONMENTS = ["appchain.blitz", "appchain.eternum"];
const BIOME_CLIMATE_OVERRIDE_LIMITS = {
  elevationScaleBps: 65_535,
  moistureScaleBps: 65_535,
  elevationBiasBps: 65_535,
  moistureBiasBps: 65_535,
  elevationSeed: 4_294_967_295,
  moistureSeed: 4_294_967_295,
};
const RECOVERABLE_FACTORY_STEP_IDS = new Set(["create-world", "wait-for-factory-index"]);
const RECOVERABLE_FACTORY_SERIES_STEP_IDS = new Set(["create-series", "create-worlds", "wait-for-factory-indexes"]);

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledFactoryMaintenance(env));
  },
};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    requireAllowedFactoryOrigin(request, env);

    if (request.method === "OPTIONS") {
      return buildCorsPreflightResponse(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/factory/runs") {
      return await handleListFactoryRuns(request, url, env);
    }

    if (request.method === "POST" && url.pathname === "/api/factory/runs") {
      return await handleCreateFactoryRun(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/factory/series-runs") {
      return await handleCreateFactorySeriesRun(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/factory/rotation-runs") {
      return await handleCreateFactoryRotationRun(request, env);
    }

    const runRoute = matchFactoryRunRoute(url.pathname);
    if (runRoute) {
      if (request.method === "GET") {
        return await handleReadFactoryRun(request, runRoute, env);
      }

      if (request.method === "POST" && runRoute.action === "continue") {
        return await handleContinueFactoryRun(request, env, runRoute);
      }

      if (request.method === "POST" && runRoute.action === "delete") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleDeleteFactoryRun(request, env, runRoute);
      }

      return buildJsonResponse(request, env, { error: "Not found" }, 404);
    }

    const seriesRunRoute = matchFactorySeriesRunRoute(url.pathname);
    if (seriesRunRoute) {
      if (request.method === "GET") {
        return await handleReadFactorySeriesRun(request, seriesRunRoute, env);
      }

      if (request.method === "POST" && seriesRunRoute.action === "continue") {
        return await handleContinueFactorySeriesRun(request, env, seriesRunRoute);
      }

      if (request.method === "POST" && seriesRunRoute.action === "cancel-auto-retry") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleCancelFactorySeriesAutoRetry(request, env, seriesRunRoute);
      }

      if (request.method === "POST" && seriesRunRoute.action === "delete") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleDeleteFactorySeriesRun(request, env, seriesRunRoute);
      }

      return buildJsonResponse(request, env, { error: "Not found" }, 404);
    }

    const rotationRunRoute = matchFactoryRotationRunRoute(url.pathname);
    if (rotationRunRoute) {
      if (request.method === "GET") {
        return await handleReadFactoryRotationRun(request, rotationRunRoute, env);
      }

      if (request.method === "POST" && rotationRunRoute.action === "continue") {
        return await handleContinueFactoryRotationRun(request, env, rotationRunRoute);
      }

      if (request.method === "POST" && rotationRunRoute.action === "nudge") {
        return await handleNudgeFactoryRotationRun(request, env, rotationRunRoute);
      }

      if (request.method === "POST" && rotationRunRoute.action === "cancel-auto-retry") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleCancelFactoryRotationAutoRetry(request, env, rotationRunRoute);
      }

      if (request.method === "POST" && rotationRunRoute.action === "delete") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleDeleteFactoryRotationRun(request, env, rotationRunRoute);
      }

      return buildJsonResponse(request, env, { error: "Not found" }, 404);
    }

    return buildJsonResponse(request, env, { error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status >= 500) logUnexpectedWorkerError(request, error);
      return buildJsonResponse(request, env, { error: error.message }, error.status);
    }

    logUnexpectedWorkerError(request, error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return buildJsonResponse(request, env, { error: message }, 500);
  }
}

async function handleCreateFactoryRun(request, env) {
  const body = await readJsonBody(request);
  validateCreateFactoryRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const existingRun = await readFactoryRunIfPresent(
    github,
    body.environment,
    body.gameName,
    resolveRunStoreBranch(env),
  );

  if (existingRun && hasActiveLease(existingRun)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "A launch is already in progress for this game",
        run: enrichFactoryRunResponse(existingRun),
      },
      409,
    );
  }

  const workflowRun = await dispatchGameLaunchWorkflow(github, {
    environment: body.environment,
    gameName: body.gameName,
    gameStartTime: body.gameStartTime,
    devModeOn: body.devModeOn,
    singleRealmMode: body.singleRealmMode,
    twoPlayerMode: body.twoPlayerMode,
    durationSeconds: body.durationSeconds,
    mapConfigOverrides: body.mapConfigOverrides,
    biomeClimateOverrides: body.biomeClimateOverrides,
    blitzRegistrationOverrides: body.blitzRegistrationOverrides,
    launchStep: "full",
  });

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleCreateFactorySeriesRun(request, env) {
  const body = await readJsonBody(request);
  validateCreateFactorySeriesRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const existingRun = await readFactorySeriesRunIfPresent(
    github,
    body.environment,
    body.seriesName,
    resolveRunStoreBranch(env),
  );

  if (existingRun && hasActiveLease(existingRun)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "A series launch is already in progress for this series",
        run: enrichFactoryRunResponse(existingRun),
      },
      409,
    );
  }

  const workflowRun = await dispatchGameLaunchWorkflow(github, {
    launchKind: "series",
    environment: body.environment,
    seriesName: body.seriesName,
    games: body.games,
    devModeOn: body.devModeOn,
    singleRealmMode: body.singleRealmMode,
    twoPlayerMode: body.twoPlayerMode,
    durationSeconds: body.durationSeconds,
    mapConfigOverrides: body.mapConfigOverrides,
    biomeClimateOverrides: body.biomeClimateOverrides,
    blitzRegistrationOverrides: body.blitzRegistrationOverrides,
    autoRetryEnabled: body.autoRetryEnabled,
    autoRetryIntervalMinutes: body.autoRetryIntervalMinutes,
    launchStep: "full",
  });

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleCreateFactoryRotationRun(request, env) {
  const body = await readJsonBody(request);
  validateCreateFactoryRotationRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const existingRun = await readFactoryRotationRunIfPresent(
    github,
    body.environment,
    body.rotationName,
    resolveRunStoreBranch(env),
  );

  if (existingRun) {
    return buildJsonResponse(
      request,
      env,
      {
        error: hasActiveLease(existingRun)
          ? "A rotation launch is already in progress for this rotation"
          : "This rotation already exists. Open it to monitor, continue, or nudge it.",
        run: enrichFactoryRunResponse(existingRun),
      },
      409,
    );
  }

  const workflowRun = await dispatchGameLaunchWorkflow(github, {
    launchKind: "rotation",
    environment: body.environment,
    rotationName: body.rotationName,
    firstGameStartTime: body.firstGameStartTime,
    gameIntervalMinutes: body.gameIntervalMinutes,
    maxGames: body.maxGames,
    advanceWindowGames: body.advanceWindowGames,
    evaluationIntervalMinutes: body.evaluationIntervalMinutes,
    weeklyCadence: body.weeklyCadence,
    devModeOn: body.devModeOn,
    singleRealmMode: body.singleRealmMode,
    twoPlayerMode: body.twoPlayerMode,
    durationSeconds: body.durationSeconds,
    mapConfigOverrides: body.mapConfigOverrides,
    biomeClimateOverrides: body.biomeClimateOverrides,
    biomeClimateOverridesByGameNumber: body.biomeClimateOverridesByGameNumber,
    blitzRegistrationOverrides: body.blitzRegistrationOverrides,
    autoRetryEnabled: body.autoRetryEnabled,
    autoRetryIntervalMinutes: body.autoRetryIntervalMinutes,
    launchStep: "full",
  });

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleListFactoryRuns(request, url, env) {
  const environment = url.searchParams.get("environment");
  validateEnvironment(environment);

  const github = createGitHubClient(env);
  const branch = resolveRunStoreBranch(env);
  const limit = resolveFactoryRecentRunListLimit(url);
  const runs = await readRecentFactoryRunsForEnvironment(github, environment, branch, limit);
  return buildJsonResponse(request, env, { runs: runs.map(enrichFactoryRunResponse) }, 200);
}

async function handleContinueFactoryRun(request, env, route) {
  const body = await readJsonBody(request);
  validateContinueFactoryRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const run = await readFactoryRunIfPresent(github, route.environment, route.gameName, resolveRunStoreBranch(env));

  if (!run) {
    logFactoryWarning("run_lookup_miss", {
      environment: route.environment,
      gameName: route.gameName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(request, env, { error: resolveMissingRunMessage(route.environment, route.gameName) }, 404);
  }

  if (hasActiveLease(run)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "A launch step is already in progress for this game",
        run: enrichFactoryRunResponse(run),
      },
      409,
    );
  }

  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, resolveRunStoreBranch(env));
  if (!inputRecord) {
    logFactoryWarning("launch_input_miss", {
      inputPath: run.inputPath,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const launchStep = body.launchStep || resolveRequiredContinueLaunchStep(run, resolveFactoryContinueStepId, "run");
  const workflowRequest = buildContinueWorkflowRequest(route, run, inputRecord, launchStep);
  validateLaunchWorkflowScopeForEnvironment(workflowRequest.environment, workflowRequest.launchStep);
  const workflowRun = await dispatchGameLaunchWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    workflowRequest,
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleReadFactoryRun(request, route, env) {
  const github = createGitHubClient(env);
  const run = await readFactoryRunIfPresent(github, route.environment, route.gameName, resolveRunStoreBranch(env));

  if (!run) {
    logFactoryWarning("run_lookup_miss", {
      environment: route.environment,
      gameName: route.gameName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(request, env, { error: resolveMissingRunMessage(route.environment, route.gameName) }, 404);
  }

  return buildJsonResponse(request, env, enrichFactoryRunResponse(run), 200);
}

async function handleReadFactorySeriesRun(request, route, env) {
  const github = createGitHubClient(env);
  const run = await readFactorySeriesRunIfPresent(
    github,
    route.environment,
    route.seriesName,
    resolveRunStoreBranch(env),
  );

  if (!run) {
    logFactoryWarning("series_run_lookup_miss", {
      environment: route.environment,
      seriesName: route.seriesName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingSeriesRunMessage(route.environment, route.seriesName) },
      404,
    );
  }

  return buildJsonResponse(request, env, enrichFactoryRunResponse(run), 200);
}

async function handleContinueFactorySeriesRun(request, env, route) {
  const body = await readJsonBody(request);
  validateContinueFactorySeriesRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const run = await readFactorySeriesRunIfPresent(
    github,
    route.environment,
    route.seriesName,
    resolveRunStoreBranch(env),
  );

  if (!run) {
    logFactoryWarning("series_run_lookup_miss", {
      environment: route.environment,
      seriesName: route.seriesName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingSeriesRunMessage(route.environment, route.seriesName) },
      404,
    );
  }

  if (hasActiveLease(run)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "A launch step is already in progress for this series",
        run: enrichFactoryRunResponse(run),
      },
      409,
    );
  }

  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, resolveRunStoreBranch(env));
  if (!inputRecord) {
    logFactoryWarning("series_launch_input_miss", {
      inputPath: run.inputPath,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const launchStep =
    body.launchStep || resolveRequiredContinueLaunchStep(run, resolveFactorySeriesContinueStepId, "series");
  const workflowRequest = buildContinueSeriesWorkflowRequest(route, run, inputRecord, launchStep, body.gameNames);
  validateSeriesLaunchWorkflowScopeForEnvironment(workflowRequest.environment, workflowRequest.launchStep);
  const workflowRun = await dispatchGameLaunchWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    workflowRequest,
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleCancelFactorySeriesAutoRetry(request, env, route) {
  const body = await readJsonBody(request);
  validateCancelFactoryAutoRetryBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const branch = resolveRunStoreBranch(env);
  const runRecordPath = resolveFactorySeriesRunRecordPath(route.environment, route.seriesName);
  const cancelledAt = new Date().toISOString();

  const nextRun = await updateBranchJsonFile(github, runRecordPath, branch, (currentRun) => {
    if (!currentRun) {
      throw new HttpError(404, resolveMissingSeriesRunMessage(route.environment, route.seriesName));
    }

    return {
      ...currentRun,
      updatedAt: cancelledAt,
      autoRetry: {
        ...currentRun.autoRetry,
        enabled: false,
        nextRetryAt: undefined,
        cancelledAt,
        cancelReason: body.cancelReason?.trim() || currentRun.autoRetry.cancelReason,
      },
    };
  });

  return buildJsonResponse(request, env, enrichFactoryRunResponse(nextRun), 200);
}

async function handleCancelFactoryRotationAutoRetry(request, env, route) {
  const body = await readJsonBody(request);
  validateCancelFactoryAutoRetryBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const branch = resolveRunStoreBranch(env);
  const runRecordPath = resolveFactoryRotationRunRecordPath(route.environment, route.rotationName);
  const cancelledAt = new Date().toISOString();

  const nextRun = await updateBranchJsonFile(github, runRecordPath, branch, (currentRun) => {
    if (!currentRun) {
      throw new HttpError(404, resolveMissingRotationRunMessage(route.environment, route.rotationName));
    }

    return {
      ...currentRun,
      updatedAt: cancelledAt,
      autoRetry: {
        ...currentRun.autoRetry,
        enabled: false,
        nextRetryAt: undefined,
        cancelledAt,
        cancelReason: body.cancelReason?.trim() || currentRun.autoRetry.cancelReason,
      },
    };
  });

  return buildJsonResponse(request, env, enrichFactoryRunResponse(nextRun), 200);
}

async function handleDeleteFactoryRun(request, env, route) {
  const github = createGitHubClient(env);
  const branch = resolveRunStoreBranch(env);
  const run = await readFactoryRunIfPresent(github, route.environment, route.gameName, branch);

  if (!run) {
    return buildJsonResponse(request, env, { error: resolveMissingRunMessage(route.environment, route.gameName) }, 404);
  }

  const deleted = await deleteFactoryStoredRun(github, branch, run);
  return buildJsonResponse(request, env, { deleted }, 200);
}

async function handleDeleteFactorySeriesRun(request, env, route) {
  const github = createGitHubClient(env);
  const branch = resolveRunStoreBranch(env);
  const run = await readFactorySeriesRunIfPresent(github, route.environment, route.seriesName, branch);

  if (!run) {
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingSeriesRunMessage(route.environment, route.seriesName) },
      404,
    );
  }

  const deleted = await deleteFactoryStoredRun(github, branch, run);
  return buildJsonResponse(request, env, { deleted }, 200);
}

async function handleDeleteFactoryRotationRun(request, env, route) {
  const github = createGitHubClient(env);
  const branch = resolveRunStoreBranch(env);
  const run = await readFactoryRotationRunIfPresent(github, route.environment, route.rotationName, branch);

  if (!run) {
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingRotationRunMessage(route.environment, route.rotationName) },
      404,
    );
  }

  const deleted = await deleteFactoryStoredRun(github, branch, run);
  return buildJsonResponse(request, env, { deleted }, 200);
}

async function handleReadFactoryRotationRun(request, route, env) {
  const github = createGitHubClient(env);
  const run = await readFactoryRotationRunIfPresent(
    github,
    route.environment,
    route.rotationName,
    resolveRunStoreBranch(env),
  );

  if (!run) {
    logFactoryWarning("rotation_run_lookup_miss", {
      environment: route.environment,
      rotationName: route.rotationName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingRotationRunMessage(route.environment, route.rotationName) },
      404,
    );
  }

  return buildJsonResponse(request, env, enrichFactoryRunResponse(run), 200);
}

async function handleContinueFactoryRotationRun(request, env, route) {
  const body = await readJsonBody(request);
  validateContinueFactoryRotationRunBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const run = await readFactoryRotationRunIfPresent(
    github,
    route.environment,
    route.rotationName,
    resolveRunStoreBranch(env),
  );

  if (!run) {
    logFactoryWarning("rotation_run_lookup_miss", {
      environment: route.environment,
      rotationName: route.rotationName,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingRotationRunMessage(route.environment, route.rotationName) },
      404,
    );
  }

  if (hasActiveLease(run)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "A launch step is already in progress for this rotation",
        run: enrichFactoryRunResponse(run),
      },
      409,
    );
  }

  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, resolveRunStoreBranch(env));
  if (!inputRecord) {
    logFactoryWarning("rotation_launch_input_miss", {
      inputPath: run.inputPath,
      branch: resolveRunStoreBranch(env),
    });
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const launchStep =
    body.launchStep || resolveRequiredContinueLaunchStep(run, resolveFactorySeriesContinueStepId, "rotation");
  const workflowRequest = buildContinueRotationWorkflowRequest(route, run, inputRecord, launchStep, body.gameNames);
  validateRotationLaunchWorkflowScopeForEnvironment(workflowRequest.environment, workflowRequest.launchStep);
  const workflowRun = await dispatchGameLaunchWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    workflowRequest,
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

async function handleNudgeFactoryRotationRun(request, env, route) {
  const body = await readJsonBody(request);
  validateWorkflowRef(body.workflowRef);

  const github = createGitHubClient(env, body.workflowRef);
  const branch = resolveRunStoreBranch(env);
  const run = await readFactoryRotationRunIfPresent(github, route.environment, route.rotationName, branch);

  if (!run) {
    return buildJsonResponse(
      request,
      env,
      { error: resolveMissingRotationRunMessage(route.environment, route.rotationName) },
      404,
    );
  }

  if (hasActiveLease(run)) {
    return buildJsonResponse(
      request,
      env,
      {
        error: "This rotation is already being evaluated",
        run: enrichFactoryRunResponse(run),
      },
      409,
    );
  }

  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
  if (!inputRecord) {
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const nudgedAt = new Date().toISOString();
  const workflowRequest = buildNudgeRotationWorkflowRequest(route, run, inputRecord);
  const workflowRun = await dispatchGameLaunchWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    workflowRequest,
  );

  await updateBranchJsonFile(
    github,
    resolveFactoryRotationRunRecordPath(route.environment, route.rotationName),
    branch,
    (currentRun) => ({
      ...currentRun,
      updatedAt: nudgedAt,
      evaluation: {
        ...currentRun.evaluation,
        lastEvaluatedAt: nudgedAt,
        lastNudgedAt: nudgedAt,
        nextEvaluationAt: new Date(
          Date.parse(nudgedAt) + Number(currentRun.evaluation?.intervalMinutes || 15) * 60_000,
        ).toISOString(),
      },
    }),
    `factory-runs: nudge rotation for ${route.environment}/${route.rotationName}`,
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      workflowRun,
    },
    202,
  );
}

function validateCreateFactoryRunBody(body) {
  validateEnvironment(body.environment);
  validateGameName(body.gameName);
  validateWorkflowRef(body.workflowRef);
  validateMapConfigOverrides(body.mapConfigOverrides);
  validateBiomeClimateOverrides(body.biomeClimateOverrides);
  validateBlitzRegistrationOverrides(body.blitzRegistrationOverrides);

  if (!body.gameStartTime?.trim()) {
    throw new HttpError(400, "gameStartTime is required");
  }
}

function validateCreateFactorySeriesRunBody(body) {
  validateEnvironment(body.environment);
  validateSeriesName(body.seriesName);
  validateWorkflowRef(body.workflowRef);
  validateMapConfigOverrides(body.mapConfigOverrides);
  validateBiomeClimateOverrides(body.biomeClimateOverrides);
  validateBlitzRegistrationOverrides(body.blitzRegistrationOverrides);
  validateSeriesGames(body.games);

  if (body.autoRetryIntervalMinutes !== undefined) {
    validatePositiveNumber(body.autoRetryIntervalMinutes, "autoRetryIntervalMinutes");
  }
}

function validateCreateFactoryRotationRunBody(body) {
  validateEnvironment(body.environment);
  validateSeriesName(body.rotationName);
  validateWorkflowRef(body.workflowRef);
  validateMapConfigOverrides(body.mapConfigOverrides);
  validateBiomeClimateOverrides(body.biomeClimateOverrides);
  validateBiomeClimateOverridesByGameNumber(body.biomeClimateOverridesByGameNumber);
  validateBlitzRegistrationOverrides(body.blitzRegistrationOverrides);

  if (hasWeeklyCadence(body)) {
    validateWeeklyCadence(body.weeklyCadence);
  } else {
    validatePositiveNumber(body.gameIntervalMinutes, "gameIntervalMinutes");
  }

  validatePositiveNumber(body.maxGames, "maxGames");
  validatePositiveNumber(body.evaluationIntervalMinutes, "evaluationIntervalMinutes");

  if (!body.firstGameStartTime?.trim()) {
    throw new HttpError(400, "firstGameStartTime is required");
  }

  if (body.advanceWindowGames !== undefined) {
    validatePositiveNumber(body.advanceWindowGames, "advanceWindowGames");
    if (body.advanceWindowGames > 5) {
      throw new HttpError(400, "advanceWindowGames cannot be greater than 5");
    }
  }

  if (body.autoRetryIntervalMinutes !== undefined) {
    validatePositiveNumber(body.autoRetryIntervalMinutes, "autoRetryIntervalMinutes");
  }
}

const WEEKLY_CADENCE_WEEKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

function hasWeeklyCadence(body) {
  return Array.isArray(body.weeklyCadence) && body.weeklyCadence.length > 0;
}

function validateWeeklyCadence(weeklyCadence) {
  if (!Array.isArray(weeklyCadence) || weeklyCadence.length === 0) {
    throw new HttpError(400, "weeklyCadence must be a non-empty array");
  }

  const scheduledOffsets = new Set();
  for (const [index, entry] of weeklyCadence.entries()) {
    validateWeeklyCadenceEntry(entry, index);
    const scheduledOffset = resolveWeeklyCadenceOffsetKey(entry);
    if (scheduledOffsets.has(scheduledOffset)) {
      throw new HttpError(400, `weeklyCadence contains more than one game at ${entry.weekday} ${entry.utcTime} UTC`);
    }
    scheduledOffsets.add(scheduledOffset);
  }
}

function resolveWeeklyCadenceOffsetKey(entry) {
  return `${entry.weekday.toLowerCase()}-${entry.utcTime}`;
}

function validateWeeklyCadenceEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new HttpError(400, `weeklyCadence entry ${index + 1} must be an object`);
  }

  if (typeof entry.gameNamePrefix !== "string" || !entry.gameNamePrefix.trim()) {
    throw new HttpError(400, `weeklyCadence entry ${index + 1} requires gameNamePrefix`);
  }

  if (typeof entry.weekday !== "string" || !WEEKLY_CADENCE_WEEKDAYS.has(entry.weekday.toLowerCase())) {
    throw new HttpError(400, `weeklyCadence entry ${index + 1} has an unsupported weekday`);
  }

  if (typeof entry.utcTime !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(entry.utcTime)) {
    throw new HttpError(400, `weeklyCadence entry ${index + 1} utcTime must be HH:MM in UTC`);
  }

  validateBlitzRegistrationOverrides(entry.blitzRegistrationOverrides);
  validateBiomeClimateOverrides(entry.biomeClimateOverrides);
}

function validateContinueFactoryRunBody(body) {
  if (body.launchStep !== undefined) {
    validateLaunchWorkflowScope(body.launchStep);
  }

  validateWorkflowRef(body.workflowRef);
}

function validateContinueFactorySeriesRunBody(body) {
  if (body.launchStep !== undefined) {
    validateSeriesLaunchWorkflowScope(body.launchStep);
  }

  validateContinueTargetGameNames(body.gameNames);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueFactoryRotationRunBody(body) {
  if (body.launchStep !== undefined) {
    validateRotationLaunchWorkflowScope(body.launchStep);
  }

  validateContinueTargetGameNames(body.gameNames);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueTargetGameNames(gameNames) {
  if (gameNames === undefined) {
    return;
  }

  validateGameNameList(gameNames, {
    missingListMessage: "gameNames must be an array",
    duplicateLabel: "Target game",
  });
}

function validateCancelFactoryAutoRetryBody(body) {
  validateWorkflowRef(body.workflowRef);

  if (body.cancelReason !== undefined && typeof body.cancelReason !== "string") {
    throw new HttpError(400, "cancelReason must be a string");
  }
}

function buildContinueWorkflowRequest(route, run, inputRecord, launchStep) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const normalizedLaunchStep = resolveRecoveryLaunchScope(run, launchStep);
  const environment = inputRecord.environment || rawRequest.environmentId || route.environment;
  const gameName = inputRecord.gameName || rawRequest.gameName || route.gameName;
  const gameStartTime = rawRequest.startTime ?? inputRecord.startTime;

  if (!environment || !gameName || gameStartTime === undefined || gameStartTime === null) {
    logFactoryError("launch_input_invalid", {
      environment: route.environment,
      gameName: route.gameName,
      inputPath: inputRecord.inputPath,
      inputKeys: Object.keys(inputRecord || {}),
      requestKeys: rawRequest ? Object.keys(rawRequest) : [],
    });
    throw new HttpError(502, "Stored launch input is missing required fields");
  }

  return {
    environment,
    gameName,
    gameStartTime: String(gameStartTime),
    rpcUrl: rawRequest.rpcUrl,
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    executionMode: rawRequest.executionMode,
    verboseConfigLogs: rawRequest.verboseConfigLogs,
    version: rawRequest.version,
    waitForFactoryIndexTimeoutMs: rawRequest.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs: rawRequest.waitForFactoryIndexPollMs,
    dryRun: rawRequest.dryRun,
    launchStep: normalizedLaunchStep,
  };
}

function buildContinueSeriesWorkflowRequest(route, run, inputRecord, launchStep, requestedGameNames) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const normalizedLaunchStep = resolveSeriesRecoveryLaunchScope(run, launchStep);
  const environment = inputRecord.environment || rawRequest.environmentId || route.environment;
  const seriesName = inputRecord.seriesName || rawRequest.seriesName || route.seriesName;
  const games = Array.isArray(rawRequest.games) ? rawRequest.games : [];
  const targetGameNames = resolveContinueTargetGameNames(run.summary?.games, requestedGameNames, normalizedLaunchStep, {
    label: "series",
    runName: seriesName || route.seriesName,
  });

  if (!environment || !seriesName || games.length === 0) {
    logFactoryError("series_launch_input_invalid", {
      environment: route.environment,
      seriesName: route.seriesName,
      inputPath: inputRecord.inputPath,
      inputKeys: Object.keys(inputRecord || {}),
      requestKeys: rawRequest ? Object.keys(rawRequest) : [],
    });
    throw new HttpError(502, "Stored series launch input is missing required fields");
  }

  return {
    launchKind: "series",
    environment,
    seriesName,
    games,
    rpcUrl: rawRequest.rpcUrl,
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    executionMode: rawRequest.executionMode,
    verboseConfigLogs: rawRequest.verboseConfigLogs,
    version: rawRequest.version,
    waitForFactoryIndexTimeoutMs: rawRequest.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs: rawRequest.waitForFactoryIndexPollMs,
    dryRun: rawRequest.dryRun,
    autoRetryEnabled: rawRequest.autoRetryEnabled,
    autoRetryIntervalMinutes: rawRequest.autoRetryIntervalMinutes,
    targetGameNames,
    launchStep: normalizedLaunchStep,
  };
}

function buildContinueRotationWorkflowRequest(route, run, inputRecord, launchStep, requestedGameNames) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const normalizedLaunchStep = resolveRotationRecoveryLaunchScope(run, launchStep);
  const environment = inputRecord.environment || rawRequest.environmentId || route.environment;
  const rotationName = inputRecord.rotationName || rawRequest.rotationName || route.rotationName;
  const weeklyCadence = resolveRotationWeeklyCadence(rawRequest, run.summary);
  const targetGameNames = resolveContinueTargetGameNames(run.summary?.games, requestedGameNames, normalizedLaunchStep, {
    label: "rotation",
    runName: rotationName || route.rotationName,
  });

  if (!environment || !rotationName) {
    logFactoryError("rotation_launch_input_invalid", {
      environment: route.environment,
      rotationName: route.rotationName,
      inputPath: inputRecord.inputPath,
      inputKeys: Object.keys(inputRecord || {}),
      requestKeys: rawRequest ? Object.keys(rawRequest) : [],
    });
    throw new HttpError(502, "Stored rotation launch input is missing required fields");
  }

  return {
    launchKind: "rotation",
    environment,
    rotationName,
    firstGameStartTime: String(rawRequest.firstGameStartTime),
    gameIntervalMinutes: resolveRotationGameIntervalMinutes(rawRequest, run.summary, weeklyCadence),
    maxGames: rawRequest.maxGames ?? run.summary?.maxGames,
    advanceWindowGames: rawRequest.advanceWindowGames ?? run.summary?.advanceWindowGames,
    evaluationIntervalMinutes: rawRequest.evaluationIntervalMinutes ?? run.summary?.evaluationIntervalMinutes,
    weeklyCadence,
    rpcUrl: rawRequest.rpcUrl,
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    executionMode: rawRequest.executionMode,
    verboseConfigLogs: rawRequest.verboseConfigLogs,
    version: rawRequest.version,
    waitForFactoryIndexTimeoutMs: rawRequest.waitForFactoryIndexTimeoutMs,
    waitForFactoryIndexPollMs: rawRequest.waitForFactoryIndexPollMs,
    dryRun: rawRequest.dryRun,
    autoRetryEnabled: rawRequest.autoRetryEnabled,
    autoRetryIntervalMinutes: rawRequest.autoRetryIntervalMinutes,
    targetGameNames,
    launchStep: normalizedLaunchStep,
  };
}

function resolveRotationWeeklyCadence(rawRequest, summary) {
  if (rawRequest.weeklyCadence?.length) {
    return rawRequest.weeklyCadence;
  }

  if (summary?.weeklyCadence?.length) {
    return summary.weeklyCadence;
  }

  return undefined;
}

function resolveRotationGameIntervalMinutes(rawRequest, summary, weeklyCadence) {
  if (weeklyCadence?.length) {
    return undefined;
  }

  return rawRequest.gameIntervalMinutes ?? summary?.gameIntervalMinutes;
}

function buildNudgeRotationWorkflowRequest(route, run, inputRecord) {
  return buildContinueRotationWorkflowRequest(route, run, inputRecord, "full");
}

function resolveContinueTargetGameNames(games, requestedGameNames, launchStep, context) {
  if (requestedGameNames === undefined) {
    return undefined;
  }

  if (launchStep !== "create-worlds" && launchStep !== "wait-for-factory-indexes") {
    throw new HttpError(400, "gameNames requires a grouped game step");
  }

  const availableGameNames = new Set((Array.isArray(games) ? games : []).map((game) => game.gameName));
  const normalizedGameNames = requestedGameNames.map((gameName) => gameName.trim());

  for (const gameName of normalizedGameNames) {
    if (!availableGameNames.has(gameName)) {
      throw new HttpError(400, `Game "${gameName}" does not belong to ${context.label} "${context.runName}"`);
    }
  }

  return normalizedGameNames;
}

function resolveRecoveryLaunchScope(run, requestedLaunchStep) {
  if (requestedLaunchStep === "full") {
    return requestedLaunchStep;
  }

  const firstStep = run?.steps?.[0];

  if (firstStep?.id === requestedLaunchStep && firstStep.status === "failed") {
    return "full";
  }

  return requestedLaunchStep;
}

function resolveSeriesRecoveryLaunchScope(run, requestedLaunchStep) {
  if (requestedLaunchStep === "full") {
    return requestedLaunchStep;
  }

  const firstStep = run?.steps?.[0];

  if (firstStep?.id === requestedLaunchStep && firstStep.status === "failed") {
    return "full";
  }

  return requestedLaunchStep;
}

function resolveRotationRecoveryLaunchScope(run, requestedLaunchStep) {
  return resolveSeriesRecoveryLaunchScope(run, requestedLaunchStep);
}

function resolveLaunchInputRequest(inputRecord) {
  if (!inputRecord || typeof inputRecord !== "object") {
    return {};
  }

  if (inputRecord.request && typeof inputRecord.request === "object") {
    return inputRecord.request;
  }

  return inputRecord;
}

function validateEnvironment(environment) {
  if (!FACTORY_ENVIRONMENTS.includes(environment)) {
    throw new HttpError(400, `Unsupported environment "${environment}"`);
  }
}

function validateGameName(gameName) {
  if (typeof gameName !== "string" || !gameName.trim()) {
    throw new HttpError(400, "gameName is required");
  }
}

function validateSeriesName(seriesName) {
  if (typeof seriesName !== "string" || !seriesName.trim()) {
    throw new HttpError(400, "seriesName is required");
  }
}

function validatePositiveNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new HttpError(400, `${label} must be a positive number`);
  }
}

function validateSeriesGames(games) {
  if (!Array.isArray(games) || games.length === 0) {
    throw new HttpError(400, "games must be a non-empty array");
  }

  const requestedGameNames = new Set();
  const requestedGameNumbers = new Set();

  for (const game of games) {
    if (!game || typeof game !== "object") {
      throw new HttpError(400, "Each series game must be an object");
    }

    validateGameName(game.gameName);
    const normalizedGameName = game.gameName.trim();
    if (requestedGameNames.has(normalizedGameName)) {
      throw new HttpError(400, `Series game "${normalizedGameName}" was requested more than once`);
    }
    requestedGameNames.add(normalizedGameName);

    if (
      typeof game.startTime !== "string" &&
      typeof game.startTime !== "number" &&
      typeof game.start_time !== "string" &&
      typeof game.start_time !== "number"
    ) {
      throw new HttpError(400, "Each series game must include a startTime");
    }

    if (
      game.seriesGameNumber !== undefined &&
      (typeof game.seriesGameNumber !== "number" ||
        !Number.isFinite(game.seriesGameNumber) ||
        !Number.isInteger(game.seriesGameNumber) ||
        game.seriesGameNumber <= 0)
    ) {
      throw new HttpError(400, "seriesGameNumber must be a positive integer");
    }

    if (game.seriesGameNumber !== undefined) {
      if (requestedGameNumbers.has(game.seriesGameNumber)) {
        throw new HttpError(400, `seriesGameNumber ${game.seriesGameNumber} was requested more than once`);
      }
      requestedGameNumbers.add(game.seriesGameNumber);
    }

    validateBiomeClimateOverrides(game.biomeClimateOverrides);
  }
}

function validateGameNameList(gameNames, options) {
  if (!Array.isArray(gameNames)) {
    throw new HttpError(400, options.missingListMessage);
  }

  if (options.requireAtLeastOne && gameNames.length === 0) {
    throw new HttpError(400, options.missingListMessage);
  }

  const seenGameNames = new Set();

  for (const gameName of gameNames) {
    if (typeof gameName !== "string" || !gameName.trim()) {
      throw new HttpError(400, "gameNames must contain non-empty strings");
    }

    const normalizedGameName = gameName.trim();

    if (seenGameNames.has(normalizedGameName)) {
      throw new HttpError(400, `${options.duplicateLabel} "${normalizedGameName}" was requested more than once`);
    }

    seenGameNames.add(normalizedGameName);
  }
}

function validateLaunchWorkflowScope(scope) {
  if (scope !== "full" && scope !== "create-world" && scope !== "wait-for-factory-index") {
    throw new HttpError(400, `Unsupported launch step "${scope}"`);
  }
}

function validateSeriesLaunchWorkflowScope(scope) {
  if (
    scope !== "full" &&
    scope !== "create-series" &&
    scope !== "create-worlds" &&
    scope !== "wait-for-factory-indexes"
  ) {
    throw new HttpError(400, `Unsupported series launch step "${scope}"`);
  }
}

function validateRotationLaunchWorkflowScope(scope) {
  validateSeriesLaunchWorkflowScope(scope);
}

function validateLaunchWorkflowScopeForEnvironment(environment, scope) {
  validateEnvironment(environment);
  validateLaunchWorkflowScope(scope);
}

function validateSeriesLaunchWorkflowScopeForEnvironment(environment, scope) {
  validateEnvironment(environment);
  validateSeriesLaunchWorkflowScope(scope);
}

function validateRotationLaunchWorkflowScopeForEnvironment(environment, scope) {
  validateSeriesLaunchWorkflowScopeForEnvironment(environment, scope);
}

function validateWorkflowRef(workflowRef) {
  if (workflowRef === undefined || workflowRef === null || workflowRef === "") {
    return;
  }

  if (typeof workflowRef !== "string") {
    throw new HttpError(400, "workflowRef must be a string");
  }
}

function resolveFactoryWorkerAdminSecret(env) {
  return env.FACTORY_WORKER_ADMIN_SECRET || env.FACTORY_ADMIN_SECRET || null;
}

function requireFactoryWorkerAdminAuthorization(request, env) {
  const expectedSecret = resolveFactoryWorkerAdminSecret(env);
  if (!expectedSecret) {
    throw new HttpError(503, "FACTORY_WORKER_ADMIN_SECRET is not configured");
  }

  const providedSecret = request.headers.get(FACTORY_WORKER_ADMIN_SECRET_HEADER);
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new HttpError(401, "Unauthorized");
  }
}

function resolveRunStoreBranch(env) {
  return env.FACTORY_RUN_STORE_BRANCH || "factory-runs";
}

function hasActiveLease(run) {
  if (!run.activeLease) {
    return false;
  }

  return Date.parse(run.activeLease.expiresAt) > Date.now();
}

function enrichFactoryRunResponse(run) {
  return {
    ...run,
    recovery: resolveFactoryRunRecovery(run),
  };
}

function resolveFactoryRunRecovery(run) {
  if (run.kind === "series" || run.kind === "rotation") {
    return resolveFactorySeriesRunRecovery(run);
  }

  const continueStepId = resolveFactoryContinueStepId(run);

  if (run.status === "complete") {
    return {
      state: "complete",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (hasFailedFactoryRunStep(run)) {
    if (!continueStepId) {
      return {
        state: "failed",
        canContinue: false,
        continueStepId: null,
      };
    }

    return {
      state: "failed",
      canContinue: true,
      continueStepId,
    };
  }

  if (hasActiveLease(run) || hasRunningFactoryRunStep(run)) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (!continueStepId) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (!hasExceededFactoryRunRecoveryGracePeriod(run)) {
    return {
      state: "transitioning",
      canContinue: false,
      continueStepId: null,
    };
  }

  return {
    state: "stalled",
    canContinue: true,
    continueStepId,
  };
}

function resolveFactorySeriesRunRecovery(run) {
  const continueStepId = resolveFactorySeriesContinueStepId(run);

  if (run.status === "complete") {
    return {
      state: "complete",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (hasActiveLease(run) || hasRunningFactoryRunStep(run)) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (!continueStepId) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (hasFailedFactoryRunStep(run)) {
    return {
      state: "failed",
      canContinue: true,
      continueStepId,
    };
  }

  if (!hasExceededFactorySeriesRunRecoveryGracePeriod(run)) {
    return {
      state: "transitioning",
      canContinue: false,
      continueStepId: null,
    };
  }

  return {
    state: "stalled",
    canContinue: true,
    continueStepId,
  };
}

function hasFailedFactoryRunStep(run) {
  return run.steps.some((step) => step.status === "failed");
}

function hasRunningFactoryRunStep(run) {
  return run.steps.some((step) => step.status === "running");
}

function resolveFactoryContinueStepId(run) {
  const failedStep = run.steps.find((step) => step.status === "failed" && isRecoverableFactoryStepId(step.id));
  if (failedStep) {
    return failedStep.id;
  }

  const currentStepId = run.currentStepId;
  if (isRecoverableFactoryStepId(currentStepId) && isPendingFactoryStep(run, currentStepId)) {
    return currentStepId;
  }

  const pendingStep = run.steps.find((step) => step.status === "pending" && isRecoverableFactoryStepId(step.id));
  return pendingStep?.id || null;
}

function isPendingFactoryStep(run, stepId) {
  return run.steps.some((step) => step.id === stepId && step.status === "pending");
}

function isRecoverableFactoryStepId(stepId) {
  return typeof stepId === "string" && RECOVERABLE_FACTORY_STEP_IDS.has(stepId);
}

function resolveFactorySeriesContinueStepId(run) {
  const failedStep = run.steps.find((step) => step.status === "failed" && isRecoverableFactorySeriesStepId(step.id));
  if (failedStep) {
    return failedStep.id;
  }

  const currentStepId = run.currentStepId;
  if (isRecoverableFactorySeriesStepId(currentStepId) && isPendingFactoryStep(run, currentStepId)) {
    return currentStepId;
  }

  const pendingStep = run.steps.find((step) => step.status === "pending" && isRecoverableFactorySeriesStepId(step.id));
  return pendingStep?.id || null;
}

function resolveRequiredContinueLaunchStep(run, resolveContinueStepId, label) {
  const continueStepId = resolveContinueStepId(run);
  if (continueStepId) {
    return continueStepId;
  }

  throw new HttpError(409, `This ${label} cannot continue right now`);
}

function isRecoverableFactorySeriesStepId(stepId) {
  return typeof stepId === "string" && RECOVERABLE_FACTORY_SERIES_STEP_IDS.has(stepId);
}

function hasExceededFactoryRunRecoveryGracePeriod(run) {
  const updatedAtMs = Date.parse(run.updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }

  return Date.now() - updatedAtMs >= DEFAULT_FACTORY_RUN_RECOVERY_GRACE_MS;
}

function hasExceededFactorySeriesRunRecoveryGracePeriod(run) {
  const updatedAtMs = Date.parse(run.updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }

  return (
    Date.now() - updatedAtMs >=
    (run.kind === "rotation"
      ? DEFAULT_FACTORY_ROTATION_RUN_RECOVERY_GRACE_MS
      : DEFAULT_FACTORY_SERIES_RUN_RECOVERY_GRACE_MS)
  );
}

function hasActiveLeaseIndexEntry(entry) {
  const expiresAtMs = Date.parse(entry.activeLeaseExpiresAt || "");
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

function resolveFactoryIndexEntryContinueStepId(entry) {
  return entry.recoverableFailedStepId || entry.recoverablePendingStepId || null;
}

function hasExceededFactoryIndexEntryRecoveryGracePeriod(entry) {
  const updatedAtMs = Date.parse(entry.updatedAt || "");
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }

  const graceMs =
    entry.kind === "rotation"
      ? DEFAULT_FACTORY_ROTATION_RUN_RECOVERY_GRACE_MS
      : entry.kind === "series"
        ? DEFAULT_FACTORY_SERIES_RUN_RECOVERY_GRACE_MS
        : DEFAULT_FACTORY_RUN_RECOVERY_GRACE_MS;

  return Date.now() - updatedAtMs >= graceMs;
}

function resolveFactoryRunRecoveryFromIndexEntry(entry) {
  const continueStepId = resolveFactoryIndexEntryContinueStepId(entry);

  if (entry.status === "complete") {
    return {
      state: "complete",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (hasActiveLeaseIndexEntry(entry) || entry.hasRunningStep) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (!continueStepId) {
    return {
      state: "active",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (entry.kind === "game" && entry.recoverableFailedStepId) {
    return {
      state: "failed",
      canContinue: false,
      continueStepId: null,
    };
  }

  if (entry.recoverableFailedStepId) {
    return {
      state: "failed",
      canContinue: true,
      continueStepId,
    };
  }

  if (!hasExceededFactoryIndexEntryRecoveryGracePeriod(entry)) {
    return {
      state: "transitioning",
      canContinue: false,
      continueStepId: null,
    };
  }

  return {
    state: "stalled",
    canContinue: true,
    continueStepId,
  };
}

function isEligibleForSeriesAutoRetryIndexEntry(entry) {
  const recovery = resolveFactoryRunRecoveryFromIndexEntry(entry);
  const nextRetryAtMs = Date.parse(entry.autoRetry?.nextRetryAt || "");

  return (
    entry.kind === "series" &&
    entry.autoRetry?.enabled === true &&
    !entry.autoRetry?.cancelledAt &&
    entry.status !== "complete" &&
    !hasActiveLeaseIndexEntry(entry) &&
    recovery.canContinue === true &&
    Number.isFinite(nextRetryAtMs) &&
    nextRetryAtMs <= Date.now()
  );
}

function isEligibleForRotationAutoRetryIndexEntry(entry) {
  const recovery = resolveFactoryRunRecoveryFromIndexEntry(entry);
  const nextRetryAtMs = Date.parse(entry.autoRetry?.nextRetryAt || "");

  return (
    entry.kind === "rotation" &&
    entry.autoRetry?.enabled === true &&
    !entry.autoRetry?.cancelledAt &&
    entry.status !== "complete" &&
    !hasActiveLeaseIndexEntry(entry) &&
    recovery.canContinue === true &&
    Number.isFinite(nextRetryAtMs) &&
    nextRetryAtMs <= Date.now()
  );
}

function isEligibleForRotationEvaluationIndexEntry(entry) {
  const recovery = resolveFactoryRunRecoveryFromIndexEntry(entry);
  const nextEvaluationAtMs = Date.parse(entry.evaluation?.nextEvaluationAt || "");

  return (
    entry.kind === "rotation" &&
    entry.status !== "complete" &&
    !hasActiveLeaseIndexEntry(entry) &&
    recovery.canContinue === false &&
    Number.isFinite(nextEvaluationAtMs) &&
    nextEvaluationAtMs <= Date.now()
  );
}

function matchFactoryRunRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 5 && parts[0] === "api" && parts[1] === "factory" && parts[2] === "runs") {
    const environment = decodeURIComponent(parts[3]);
    const gameName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, gameName };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "runs" &&
    parts[5] === "actions" &&
    parts[6] === "continue"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const gameName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, gameName, action: "continue" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "runs" &&
    parts[5] === "actions" &&
    parts[6] === "delete"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const gameName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, gameName, action: "delete" };
  }

  return null;
}

function matchFactorySeriesRunRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 5 && parts[0] === "api" && parts[1] === "factory" && parts[2] === "series-runs") {
    const environment = decodeURIComponent(parts[3]);
    const seriesName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, seriesName };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "series-runs" &&
    parts[5] === "actions" &&
    parts[6] === "continue"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const seriesName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, seriesName, action: "continue" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "series-runs" &&
    parts[5] === "actions" &&
    parts[6] === "cancel-auto-retry"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const seriesName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, seriesName, action: "cancel-auto-retry" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "series-runs" &&
    parts[5] === "actions" &&
    parts[6] === "delete"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const seriesName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, seriesName, action: "delete" };
  }

  return null;
}

function matchFactoryRotationRunRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 5 && parts[0] === "api" && parts[1] === "factory" && parts[2] === "rotation-runs") {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "rotation-runs" &&
    parts[5] === "actions" &&
    parts[6] === "continue"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName, action: "continue" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "rotation-runs" &&
    parts[5] === "actions" &&
    parts[6] === "nudge"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName, action: "nudge" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "rotation-runs" &&
    parts[5] === "actions" &&
    parts[6] === "cancel-auto-retry"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName, action: "cancel-auto-retry" };
  }

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "rotation-runs" &&
    parts[5] === "actions" &&
    parts[6] === "delete"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName, action: "delete" };
  }

  return null;
}

async function readFactoryRunsForEnvironment(github, environment, branch) {
  const directoryPath = resolveFactoryRunDirectoryPath(environment);
  const response = await github.fetch(
    `/repos/${github.repo}/contents/${directoryPath}?ref=${encodeURIComponent(branch)}`,
    {
      method: "GET",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to list ${directoryPath}`);
  }

  const entries = await response.json();
  const fileEntries = Array.isArray(entries) ? entries.filter((entry) => entry.type === "file" && entry.path) : [];

  const runs = await Promise.all(fileEntries.map((entry) => readBranchJsonIfPresent(github, entry.path, branch)));
  return runs.filter(Boolean);
}

async function readFactorySeriesRunsForEnvironment(github, environment, branch) {
  const directoryPath = resolveFactorySeriesRunDirectoryPath(environment);
  return readFactoryRunsFromDirectory(github, directoryPath, branch);
}

async function readFactoryRotationRunsForEnvironment(github, environment, branch) {
  const directoryPath = resolveFactoryRotationRunDirectoryPath(environment);
  return readFactoryRunsFromDirectory(github, directoryPath, branch);
}

async function readRecentFactoryRunsForEnvironment(github, environment, branch, limit) {
  const recentEntries = await readRecentFactoryRunEntriesForEnvironment(github, environment, branch, limit);
  const runs = await Promise.all(recentEntries.map((entry) => readBranchJsonIfPresent(github, entry.path, branch)));
  return runs.filter(Boolean).sort(compareFactoryRunsByRecency);
}

async function readRecentFactoryRunEntriesForEnvironment(github, environment, branch, limit) {
  const [gameEntries, seriesEntries, rotationEntries] = await Promise.all([
    readFactoryGameRunMaintenanceIndexEntriesForEnvironment(github, environment, branch),
    readFactorySeriesRunMaintenanceIndexEntriesForEnvironment(github, environment, branch),
    readFactoryRotationRunMaintenanceIndexEntriesForEnvironment(github, environment, branch),
  ]);

  return [...gameEntries, ...seriesEntries, ...rotationEntries]
    .sort(compareFactoryMaintenanceEntriesByRecency)
    .slice(0, limit);
}

async function readFactoryRunsFromDirectory(github, directoryPath, branch) {
  const response = await github.fetch(
    `/repos/${github.repo}/contents/${directoryPath}?ref=${encodeURIComponent(branch)}`,
    {
      method: "GET",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to list ${directoryPath}`);
  }

  const entries = await response.json();
  const fileEntries = Array.isArray(entries) ? entries.filter((entry) => entry.type === "file" && entry.path) : [];
  const runs = await Promise.all(fileEntries.map((entry) => readBranchJsonIfPresent(github, entry.path, branch)));
  return runs.filter(Boolean);
}

async function readFactoryRunIfPresent(github, environment, gameName, branch) {
  const path = resolveFactoryRunRecordPath(environment, gameName);
  return readBranchJsonIfPresent(github, path, branch);
}

async function readFactorySeriesRunIfPresent(github, environment, seriesName, branch) {
  const path = resolveFactorySeriesRunRecordPath(environment, seriesName);
  return readBranchJsonIfPresent(github, path, branch);
}

async function readFactoryRotationRunIfPresent(github, environment, rotationName, branch) {
  const path = resolveFactoryRotationRunRecordPath(environment, rotationName);
  return readBranchJsonIfPresent(github, path, branch);
}

async function readFactoryLaunchInputIfPresent(github, path, branch) {
  return readBranchJsonIfPresent(github, path, branch);
}

async function readBranchJsonIfPresent(github, path, branch) {
  const response = await github.fetch(`/repos/${github.repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to read ${path}`);
  }

  const payload = await response.json();
  const rawContent = payload.encoding === "base64" ? decodeBase64ToText(payload.content || "") : payload.content || "";

  try {
    return JSON.parse(rawContent);
  } catch {
    logFactoryError("run_store_parse_failed", { path, branch });
    throw new HttpError(502, `Failed to parse JSON at ${path}`);
  }
}

function resolveRecoverableFailedStepId(steps, recoverableStepIds) {
  const failedStep = (steps || []).find((step) => step.status === "failed" && recoverableStepIds.has(step.id));
  return failedStep?.id || null;
}

function resolveRecoverablePendingStepId(steps, currentStepId, recoverableStepIds) {
  if (currentStepId && recoverableStepIds.has(currentStepId)) {
    const currentPendingStep = (steps || []).find((step) => step.id === currentStepId && step.status === "pending");
    if (currentPendingStep) {
      return currentPendingStep.id;
    }
  }

  const pendingStep = (steps || []).find((step) => step.status === "pending" && recoverableStepIds.has(step.id));
  return pendingStep?.id || null;
}

function buildFactoryGameRunMaintenanceIndexEntry(run) {
  return {
    kind: "game",
    environment: run.environment,
    gameName: run.gameName,
    path: resolveFactoryRunRecordPath(run.environment, run.gameName),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow?.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: (run.steps || []).some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_STEP_IDS,
    ),
  };
}

function buildFactorySeriesRunMaintenanceIndexEntry(run) {
  return {
    kind: "series",
    environment: run.environment,
    seriesName: run.seriesName,
    path: resolveFactorySeriesRunRecordPath(run.environment, run.seriesName),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow?.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: (run.steps || []).some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_SERIES_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_SERIES_STEP_IDS,
    ),
    autoRetry: run.autoRetry,
  };
}

function buildFactoryRotationRunMaintenanceIndexEntry(run) {
  return {
    kind: "rotation",
    environment: run.environment,
    rotationName: run.rotationName,
    path: resolveFactoryRotationRunRecordPath(run.environment, run.rotationName),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow?.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: (run.steps || []).some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_SERIES_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_SERIES_STEP_IDS,
    ),
    autoRetry: run.autoRetry,
    evaluation: run.evaluation,
  };
}

function buildFactoryMaintenanceIndexEntry(run) {
  switch (run?.kind) {
    case "game":
      return buildFactoryGameRunMaintenanceIndexEntry(run);
    case "series":
      return buildFactorySeriesRunMaintenanceIndexEntry(run);
    case "rotation":
      return buildFactoryRotationRunMaintenanceIndexEntry(run);
    default:
      return null;
  }
}

function resolveFactoryMaintenanceIndexEntryKey(entry) {
  switch (entry.kind) {
    case "game":
      return entry.gameName;
    case "series":
      return entry.seriesName;
    case "rotation":
      return entry.rotationName;
    default:
      throw new Error(`Unsupported maintenance index entry kind "${entry.kind}"`);
  }
}

function buildEmptyFactoryMaintenanceIndex(environment, kind) {
  return {
    version: 1,
    environment,
    kind,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

async function readFactoryMaintenanceIndexIfPresent(github, environment, kind, branch) {
  const indexPath = resolveFactoryMaintenanceIndexPath(environment, kind);
  return (
    (await readBranchJsonIfPresent(github, indexPath, branch)) || buildEmptyFactoryMaintenanceIndex(environment, kind)
  );
}

function readFactoryMaintenanceIndexEntries(index) {
  return Object.values(index?.entries || {});
}

function compareFactoryMaintenanceEntriesByRecency(left, right) {
  return compareFactoryUpdatedAtValues(right.updatedAt, left.updatedAt);
}

async function readFactoryGameRunMaintenanceIndexEntriesForEnvironment(github, environment, branch) {
  return readFactoryMaintenanceIndexEntries(
    await readFactoryMaintenanceIndexIfPresent(github, environment, "game", branch),
  );
}

async function readFactorySeriesRunMaintenanceIndexEntriesForEnvironment(github, environment, branch) {
  return readFactoryMaintenanceIndexEntries(
    await readFactoryMaintenanceIndexIfPresent(github, environment, "series", branch),
  );
}

async function readFactoryRotationRunMaintenanceIndexEntriesForEnvironment(github, environment, branch) {
  return readFactoryMaintenanceIndexEntries(
    await readFactoryMaintenanceIndexIfPresent(github, environment, "rotation", branch),
  );
}

async function updateFactoryMaintenanceIndexForRunRecord(github, branch, run) {
  const entry = buildFactoryMaintenanceIndexEntry(run);
  if (!entry) {
    return;
  }

  const entryKey = resolveFactoryMaintenanceIndexEntryKey(entry);
  const indexPath = resolveFactoryMaintenanceIndexPath(entry.environment, entry.kind);
  await updateBranchJsonFileValue(
    github,
    indexPath,
    branch,
    (currentIndex) => ({
      ...(currentIndex || buildEmptyFactoryMaintenanceIndex(entry.environment, entry.kind)),
      version: 1,
      environment: entry.environment,
      kind: entry.kind,
      updatedAt: entry.updatedAt,
      entries: {
        ...(currentIndex?.entries || {}),
        [entryKey]: entry,
      },
    }),
    `factory-runs: update ${entry.kind} maintenance index for ${entry.environment}/${entryKey}`,
  );
}

async function removeFactoryMaintenanceIndexEntry(github, branch, environment, kind, entryKey) {
  const indexPath = resolveFactoryMaintenanceIndexPath(environment, kind);
  const currentIndex = await readFactoryMaintenanceIndexIfPresent(github, environment, kind, branch);

  if (!currentIndex?.entries?.[entryKey]) {
    return;
  }

  await updateBranchJsonFileValue(
    github,
    indexPath,
    branch,
    (existingIndex) => {
      const nextEntries = { ...(existingIndex?.entries || {}) };
      delete nextEntries[entryKey];

      return {
        ...(existingIndex || buildEmptyFactoryMaintenanceIndex(environment, kind)),
        version: 1,
        environment,
        kind,
        updatedAt: new Date().toISOString(),
        entries: nextEntries,
      };
    },
    `factory-runs: remove ${kind} maintenance index for ${environment}/${entryKey}`,
  );
}

function resolveFactoryRunInputDirectoryPath(inputPath) {
  if (!inputPath || !inputPath.includes("/")) {
    return null;
  }

  return inputPath.slice(0, inputPath.lastIndexOf("/"));
}

function resolveFactoryStoredRunDeletionTarget(run) {
  if (run?.kind === "series") {
    return {
      kind: "series",
      environment: run.environment,
      runName: run.seriesName,
      recordPath: resolveFactorySeriesRunRecordPath(run.environment, run.seriesName),
      inputDirectoryPath: resolveFactoryRunInputDirectoryPath(run.inputPath),
      maintenanceKind: "series",
      maintenanceEntryKey: run.seriesName,
    };
  }

  if (run?.kind === "rotation") {
    return {
      kind: "rotation",
      environment: run.environment,
      runName: run.rotationName,
      recordPath: resolveFactoryRotationRunRecordPath(run.environment, run.rotationName),
      inputDirectoryPath: resolveFactoryRunInputDirectoryPath(run.inputPath),
      maintenanceKind: "rotation",
      maintenanceEntryKey: run.rotationName,
    };
  }

  return {
    kind: "game",
    environment: run.environment,
    runName: run.gameName,
    recordPath: resolveFactoryRunRecordPath(run.environment, run.gameName),
    inputDirectoryPath: resolveFactoryRunInputDirectoryPath(run.inputPath),
    maintenanceKind: "game",
    maintenanceEntryKey: run.gameName,
  };
}

async function deleteFactoryStoredRun(github, branch, run) {
  const target = resolveFactoryStoredRunDeletionTarget(run);
  const deletedInputPaths = await deleteFactoryRunInputDirectoryFiles(github, branch, target.inputDirectoryPath);

  await removeFactoryMaintenanceIndexEntry(
    github,
    branch,
    target.environment,
    target.maintenanceKind,
    target.maintenanceEntryKey,
  );
  await deleteBranchFileIfPresent(
    github,
    target.recordPath,
    branch,
    `factory-runs: delete ${target.kind} run ${target.environment}/${target.runName}`,
  );
  return {
    kind: target.kind,
    environment: target.environment,
    runName: target.runName,
    deletedRecordPath: target.recordPath,
    deletedInputPaths,
  };
}

function resolveFactoryRecentRunListLimit(url) {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);

  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return DEFAULT_FACTORY_RECENT_RUN_LIST_LIMIT;
  }

  return Math.min(rawLimit, MAX_FACTORY_RECENT_RUN_LIST_LIMIT);
}

function compareFactoryRunsByRecency(left, right) {
  return compareFactoryUpdatedAtValues(right.updatedAt, left.updatedAt);
}

function compareFactoryUpdatedAtValues(leftUpdatedAt, rightUpdatedAt) {
  const leftTimestamp = Date.parse(leftUpdatedAt || "");
  const rightTimestamp = Date.parse(rightUpdatedAt || "");

  if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp) && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  if (Number.isFinite(leftTimestamp) !== Number.isFinite(rightTimestamp)) {
    return Number.isFinite(leftTimestamp) ? 1 : -1;
  }

  return String(leftUpdatedAt || "").localeCompare(String(rightUpdatedAt || ""));
}

async function dispatchGameLaunchWorkflow(github, request) {
  const response = await github.fetch(`/repos/${github.repo}/actions/workflows/${github.workflowFile}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: github.workflowRef,
      inputs: buildGameLaunchWorkflowInputs(request),
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, "Failed to dispatch game-launch workflow");
  }

  return {
    workflowFile: github.workflowFile,
  };
}

function assignOptionalWorkflowInput(inputs, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "string") {
    if (value.length === 0) {
      return;
    }

    inputs[key] = value;
    return;
  }

  inputs[key] = String(value);
}

function assignOptionalLaunchOption(launchOptions, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "string" && value.length === 0) {
    return;
  }

  launchOptions[key] = value;
}

function buildReplayableLaunchOptions(request) {
  const launchOptions = {};

  assignOptionalLaunchOption(launchOptions, "rpcUrl", request.rpcUrl);
  assignOptionalLaunchOption(launchOptions, "accountAddress", request.accountAddress);
  assignOptionalLaunchOption(launchOptions, "devModeOn", request.devModeOn);
  assignOptionalLaunchOption(launchOptions, "singleRealmMode", request.singleRealmMode);
  assignOptionalLaunchOption(launchOptions, "twoPlayerMode", request.twoPlayerMode);
  assignOptionalLaunchOption(launchOptions, "durationSeconds", request.durationSeconds);
  assignOptionalLaunchOption(launchOptions, "weeklyCadence", request.weeklyCadence);
  assignOptionalLaunchOption(launchOptions, "mapConfigOverrides", request.mapConfigOverrides);
  assignOptionalLaunchOption(launchOptions, "biomeClimateOverrides", request.biomeClimateOverrides);
  assignOptionalLaunchOption(
    launchOptions,
    "biomeClimateOverridesByGameNumber",
    request.biomeClimateOverridesByGameNumber,
  );
  assignOptionalLaunchOption(launchOptions, "blitzRegistrationOverrides", request.blitzRegistrationOverrides);
  assignOptionalLaunchOption(launchOptions, "executionMode", request.executionMode);
  assignOptionalLaunchOption(launchOptions, "verboseConfigLogs", request.verboseConfigLogs);
  assignOptionalLaunchOption(launchOptions, "version", request.version);
  assignOptionalLaunchOption(launchOptions, "waitForFactoryIndexTimeoutMs", request.waitForFactoryIndexTimeoutMs);
  assignOptionalLaunchOption(launchOptions, "waitForFactoryIndexPollMs", request.waitForFactoryIndexPollMs);
  assignOptionalLaunchOption(launchOptions, "dryRun", request.dryRun);

  return launchOptions;
}

function buildBaseLaunchWorkflowInputs(request) {
  const inputs = {
    launch_kind: request.launchKind || "game",
    environment: request.environment,
    launch_step: request.launchStep,
  };

  const launchOptions = buildReplayableLaunchOptions(request);
  assignOptionalWorkflowInput(inputs, "config_path", request.configPath);
  if (Object.keys(launchOptions).length > 0) {
    inputs.launch_options_json = JSON.stringify(launchOptions);
  }

  return inputs;
}

function assignSeriesLaunchWorkflowInputs(inputs, request) {
  assignOptionalWorkflowInput(inputs, "series_name", request.seriesName);
  assignOptionalWorkflowInput(inputs, "series_games_json", JSON.stringify(request.games));
  assignOptionalWorkflowInput(inputs, "auto_retry_enabled", request.autoRetryEnabled === false ? "false" : "true");
  assignOptionalWorkflowInput(
    inputs,
    "auto_retry_interval_minutes",
    request.autoRetryIntervalMinutes !== undefined ? String(request.autoRetryIntervalMinutes) : undefined,
  );
  assignOptionalWorkflowInput(
    inputs,
    "target_game_names_json",
    request.targetGameNames?.length ? JSON.stringify(request.targetGameNames) : undefined,
  );
}

function assignRotationLaunchWorkflowInputs(inputs, request) {
  assignOptionalWorkflowInput(inputs, "rotation_name", request.rotationName);
  assignOptionalWorkflowInput(inputs, "first_game_start_time", request.firstGameStartTime);
  assignOptionalWorkflowInput(inputs, "game_interval_minutes", request.gameIntervalMinutes);
  assignOptionalWorkflowInput(inputs, "max_games", request.maxGames);
  assignOptionalWorkflowInput(inputs, "advance_window_games", request.advanceWindowGames);
  assignOptionalWorkflowInput(inputs, "evaluation_interval_minutes", request.evaluationIntervalMinutes);
  assignOptionalWorkflowInput(inputs, "auto_retry_enabled", request.autoRetryEnabled === false ? "false" : "true");
  assignOptionalWorkflowInput(
    inputs,
    "auto_retry_interval_minutes",
    request.autoRetryIntervalMinutes !== undefined ? String(request.autoRetryIntervalMinutes) : undefined,
  );
  assignOptionalWorkflowInput(
    inputs,
    "target_game_names_json",
    request.targetGameNames?.length ? JSON.stringify(request.targetGameNames) : undefined,
  );
}

function assignSingleGameWorkflowInputs(inputs, request) {
  assignOptionalWorkflowInput(inputs, "game_name", request.gameName);
  assignOptionalWorkflowInput(inputs, "game_start_time", request.gameStartTime);
}

function buildGameLaunchWorkflowInputs(request) {
  const inputs = buildBaseLaunchWorkflowInputs(request);

  if (request.launchKind === "series") {
    assignSeriesLaunchWorkflowInputs(inputs, request);
    return inputs;
  }

  if (request.launchKind === "rotation") {
    assignRotationLaunchWorkflowInputs(inputs, request);
    return inputs;
  }

  assignSingleGameWorkflowInputs(inputs, request);
  return inputs;
}

function validateMapConfigOverrides(value) {
  validateNumericOverrideObject(value, "mapConfigOverrides");
}

function validateBiomeClimateOverrides(value) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "biomeClimateOverrides must be an object");
  }

  for (const [key, entryValue] of Object.entries(value)) {
    validateBiomeClimateOverrideEntry(key, entryValue);
  }
}

function validateBiomeClimateOverridesByGameNumber(value) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "biomeClimateOverridesByGameNumber must be an object");
  }

  for (const [gameNumber, overrides] of Object.entries(value)) {
    const parsedGameNumber = Number(gameNumber);
    if (!Number.isInteger(parsedGameNumber) || parsedGameNumber <= 0) {
      throw new HttpError(400, "biomeClimateOverridesByGameNumber keys must be positive game numbers");
    }
    validateBiomeClimateOverrides(overrides);
  }
}

function validateBlitzRegistrationOverrides(value) {
  if (value === undefined) {
    return;
  }

  validateBlitzRegistrationOverrideObject(value);

  for (const [key, entryValue] of Object.entries(value)) {
    validateBlitzRegistrationOverrideEntry(key, entryValue);
  }
}

function validateBlitzRegistrationOverrideObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "blitzRegistrationOverrides must be an object");
  }
}

function validateBiomeClimateOverrideEntry(key, value) {
  const limit = BIOME_CLIMATE_OVERRIDE_LIMITS[key];

  if (limit === undefined) {
    throw new HttpError(400, `Unsupported biomeClimateOverrides.${key}`);
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > limit) {
    throw new HttpError(400, `biomeClimateOverrides.${key} must be an integer between 0 and ${limit}`);
  }
}

function validateBlitzRegistrationOverrideEntry(key, value) {
  switch (key) {
    case "registration_count_max":
      validateBlitzRegistrationCountMax(value);
      return;
    default:
      throw new HttpError(400, `Unsupported blitzRegistrationOverrides.${key}`);
  }
}

function validateBlitzRegistrationCountMax(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, "blitzRegistrationOverrides.registration_count_max must be a finite number");
  }
}

function validateNumericOverrideObject(value, label) {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object`);
  }

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      throw new HttpError(400, `${label}.${key} must be a finite number`);
    }
  }
}

function toWorkflowBooleanInput(value) {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

function resolveFactoryRunRecordPath(environment, gameName) {
  const [chain, gameType] = environment.split(".");
  return `runs/${chain}/${gameType}/${toSafeSlug(gameName)}.json`;
}

function resolveFactoryRunDirectoryPath(environment) {
  const [chain, gameType] = environment.split(".");
  return `runs/${chain}/${gameType}`;
}

function resolveFactorySeriesRunRecordPath(environment, seriesName) {
  return `${resolveFactorySeriesRunDirectoryPath(environment)}/${toSafeSlug(seriesName)}.json`;
}

function resolveFactorySeriesRunDirectoryPath(environment) {
  return `${resolveFactoryRunDirectoryPath(environment)}/series`;
}

function resolveFactoryRotationRunRecordPath(environment, rotationName) {
  return `${resolveFactoryRotationRunDirectoryPath(environment)}/${toSafeSlug(rotationName)}.json`;
}

function resolveFactoryRotationRunDirectoryPath(environment) {
  return `${resolveFactoryRunDirectoryPath(environment)}/rotations`;
}

function resolveFactoryMaintenanceIndexPath(environment, kind) {
  const [chain, gameType] = environment.split(".");

  switch (kind) {
    case "game":
      return `indexes/${chain}/${gameType}/games.json`;
    case "series":
      return `indexes/${chain}/${gameType}/series.json`;
    case "rotation":
      return `indexes/${chain}/${gameType}/rotations.json`;
    default:
      throw new Error(`Unsupported maintenance index kind "${kind}"`);
  }
}

function toSafeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCorsPreflightResponse(request, env) {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, env),
  });
}

function buildJsonResponse(request, env, value, status) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      ...buildCorsHeaders(request, env),
      "Content-Type": "application/json",
    },
  });
}

function buildCorsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigin = resolveAllowedFactoryOrigin(requestOrigin, env);

  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,x-factory-admin-secret",
    Vary: "Origin",
  };
}

function requireAllowedFactoryOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && !resolveAllowedFactoryOrigin(requestOrigin, env)) {
    throw new HttpError(403, "Origin is not allowed");
  }
}

function resolveAllowedFactoryOrigin(requestOrigin, env) {
  if (!requestOrigin) return undefined;
  return parseCommaSeparatedValues(env.FACTORY_ALLOWED_ORIGINS).includes(requestOrigin) ? requestOrigin : undefined;
}

function parseCommaSeparatedValues(value) {
  return [
    ...new Set(
      String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function createGitHubClient(env, workflowRefOverride) {
  ensureGitHubConfiguration(env);

  return {
    repo: env.GITHUB_REPOSITORY,
    workflowFile: env.GITHUB_WORKFLOW_FILE || "game-launch.yml",
    workflowRef: workflowRefOverride || env.GITHUB_WORKFLOW_REF || "next",
    fetch: async (path, init) => {
      return fetch(`${env.GITHUB_API_URL || "https://api.github.com"}${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": env.GITHUB_USER_AGENT || "realms-game-launch-worker",
          ...(init?.headers || {}),
        },
      });
    },
  };
}

function resolveWorkflowGitHubClient(github, inputRecord, body) {
  const workflowRef = body.workflowRef || inputRecord.workflow?.ref || github.workflowRef;

  return {
    ...github,
    workflowRef,
  };
}

async function readBranchDirectoryEntriesIfPresent(github, directoryPath, branch) {
  if (!directoryPath) {
    return [];
  }

  const response = await github.fetch(
    `/repos/${github.repo}/contents/${directoryPath}?ref=${encodeURIComponent(branch)}`,
    {
      method: "GET",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to list ${directoryPath}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload.filter((entry) => entry?.type === "file" && entry.path && entry.sha) : [];
}

async function readBranchJsonWithMetadataIfPresent(github, path, branch) {
  const response = await github.fetch(`/repos/${github.repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to read ${path}`);
  }

  const payload = await response.json();
  const rawContent = payload.encoding === "base64" ? decodeBase64ToText(payload.content || "") : payload.content || "";

  try {
    return {
      path,
      sha: payload.sha,
      value: JSON.parse(rawContent),
    };
  } catch {
    logFactoryError("run_store_parse_failed", { path, branch });
    throw new HttpError(502, `Failed to parse JSON at ${path}`);
  }
}

async function deleteBranchFileIfPresent(github, path, branch, commitMessage = `Delete ${path}`) {
  const existingRecord = await readBranchJsonWithMetadataIfPresent(github, path, branch);

  if (!existingRecord?.sha) {
    return false;
  }

  const response = await github.fetch(`/repos/${github.repo}/contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({
      branch,
      message: commitMessage,
      sha: existingRecord.sha,
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to delete ${path}`);
  }

  return true;
}

async function deleteFactoryRunInputDirectoryFiles(github, branch, directoryPath) {
  const inputEntries = await readBranchDirectoryEntriesIfPresent(github, directoryPath, branch);
  const deletedInputPaths = [];

  for (const entry of inputEntries) {
    await deleteBranchFileIfPresent(github, entry.path, branch, `factory-runs: delete launch input ${entry.path}`);
    deletedInputPaths.push(entry.path);
  }

  return deletedInputPaths;
}

async function updateBranchJsonFileValue(github, path, branch, updateValue, commitMessage = `Update ${path}`) {
  const existingRecord = await readBranchJsonWithMetadataIfPresent(github, path, branch);
  const nextValue = updateValue(existingRecord?.value || null);
  const response = await github.fetch(`/repos/${github.repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      branch,
      message: commitMessage,
      content: encodeTextToBase64(`${JSON.stringify(nextValue, null, 2)}\n`),
      sha: existingRecord?.sha,
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, `Failed to write ${path}`);
  }

  return nextValue;
}

async function updateBranchJsonFile(github, path, branch, updateValue, commitMessage = `Update ${path}`) {
  const nextValue = await updateBranchJsonFileValue(github, path, branch, updateValue, commitMessage);

  if (path.startsWith("runs/")) {
    await updateFactoryMaintenanceIndexForRunRecord(github, branch, nextValue);
  }

  return nextValue;
}

function encodeTextToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function handleScheduledFactoryMaintenance(env) {
  const github = createGitHubClient(env);
  await dispatchConfiguredFactoryRotations(github, env);
  const branch = resolveRunStoreBranch(env);
  await retryEligibleFactorySeriesRuns(github, branch);
  await retryEligibleFactoryRotationRuns(github, branch);
  await evaluateEligibleFactoryRotationRuns(github, branch);
}

async function dispatchConfiguredFactoryRotations(github, env) {
  for (const configPath of parseCommaSeparatedValues(env.FACTORY_ROTATION_CONFIGS)) {
    const environment = resolveFactoryRotationConfigEnvironment(configPath);
    try {
      await dispatchGameLaunchWorkflow(github, {
        launchKind: "rotation",
        environment,
        configPath,
        launchStep: "full",
      });
    } catch (error) {
      logFactoryError("rotation_config_dispatch_failed", {
        environment,
        configPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function resolveFactoryRotationConfigEnvironment(configPath) {
  const directory = "config/deployer/clean/launch-configs/";
  if (!configPath.startsWith(directory) || configPath.includes("..") || !configPath.endsWith(".yaml")) {
    throw new Error(`Invalid FACTORY_ROTATION_CONFIGS path "${configPath}"`);
  }

  const fileName = configPath.slice(directory.length);
  const environments = FACTORY_ENVIRONMENTS.filter((environment) =>
    fileName.startsWith(`${environment.replaceAll(".", "-")}-`),
  );
  if (environments.length !== 1) {
    throw new Error(`Cannot resolve a factory environment from rotation config "${configPath}"`);
  }
  return environments[0];
}

async function retryEligibleFactorySeriesRuns(github, branch) {
  for (const environment of FACTORY_ENVIRONMENTS) {
    const entries = await readFactorySeriesRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

    for (const entry of entries) {
      if (!isEligibleForSeriesAutoRetryIndexEntry(entry)) {
        continue;
      }

      try {
        const run = await readFactorySeriesRunIfPresent(github, environment, entry.seriesName, branch);
        if (!run || !isEligibleForSeriesAutoRetry(run)) {
          continue;
        }

        const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
        if (!inputRecord) {
          continue;
        }

        const recovery = resolveFactoryRunRecovery(run);
        const retryStartedAt = new Date().toISOString();
        const workflowRequest = buildContinueSeriesWorkflowRequest(
          { environment, seriesName: run.seriesName },
          run,
          inputRecord,
          recovery.continueStepId,
        );
        await dispatchGameLaunchWorkflow(resolveWorkflowGitHubClient(github, inputRecord, {}), workflowRequest);
        await updateBranchJsonFile(
          github,
          resolveFactorySeriesRunRecordPath(environment, run.seriesName),
          branch,
          (currentRun) => ({
            ...currentRun,
            updatedAt: retryStartedAt,
            autoRetry: {
              ...currentRun.autoRetry,
              lastRetryAt: retryStartedAt,
              nextRetryAt: new Date(
                Date.parse(retryStartedAt) +
                  Number(currentRun.autoRetry?.intervalMinutes || DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES) * 60_000,
              ).toISOString(),
            },
          }),
          `factory-runs: schedule auto retry for ${environment}/${run.seriesName}`,
        );
      } catch (error) {
        logFactoryError("series_auto_retry_failed", {
          environment,
          seriesName: run.seriesName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function isEligibleForSeriesAutoRetry(run) {
  const recovery = resolveFactoryRunRecovery(run);
  const nextRetryAtMs = Date.parse(run.autoRetry?.nextRetryAt || "");

  return (
    run?.kind === "series" &&
    run.autoRetry?.enabled === true &&
    !run.autoRetry?.cancelledAt &&
    run.status !== "complete" &&
    !hasActiveLease(run) &&
    recovery.canContinue === true &&
    Number.isFinite(nextRetryAtMs) &&
    nextRetryAtMs <= Date.now()
  );
}

async function retryEligibleFactoryRotationRuns(github, branch) {
  for (const environment of FACTORY_ENVIRONMENTS) {
    const entries = await readFactoryRotationRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

    for (const entry of entries) {
      if (!isEligibleForRotationAutoRetryIndexEntry(entry)) {
        continue;
      }

      try {
        const run = await readFactoryRotationRunIfPresent(github, environment, entry.rotationName, branch);
        if (!run || !isEligibleForRotationAutoRetry(run)) {
          continue;
        }

        const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
        if (!inputRecord) {
          continue;
        }

        const recovery = resolveFactoryRunRecovery(run);
        const retryStartedAt = new Date().toISOString();
        const workflowRequest = buildContinueRotationWorkflowRequest(
          { environment, rotationName: run.rotationName },
          run,
          inputRecord,
          recovery.continueStepId,
        );
        await dispatchGameLaunchWorkflow(resolveWorkflowGitHubClient(github, inputRecord, {}), workflowRequest);
        await updateBranchJsonFile(
          github,
          resolveFactoryRotationRunRecordPath(environment, run.rotationName),
          branch,
          (currentRun) => ({
            ...currentRun,
            updatedAt: retryStartedAt,
            autoRetry: {
              ...currentRun.autoRetry,
              lastRetryAt: retryStartedAt,
              nextRetryAt: buildNextTimestamp(
                retryStartedAt,
                Number(currentRun.autoRetry?.intervalMinutes || DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES),
              ),
            },
          }),
          `factory-runs: schedule auto retry for ${environment}/${run.rotationName}`,
        );
      } catch (error) {
        logFactoryError("rotation_auto_retry_failed", {
          environment,
          rotationName: run.rotationName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function isEligibleForRotationAutoRetry(run) {
  const recovery = resolveFactoryRunRecovery(run);
  const nextRetryAtMs = Date.parse(run.autoRetry?.nextRetryAt || "");

  return (
    run?.kind === "rotation" &&
    run.autoRetry?.enabled === true &&
    !run.autoRetry?.cancelledAt &&
    run.status !== "complete" &&
    !hasActiveLease(run) &&
    recovery.canContinue === true &&
    Number.isFinite(nextRetryAtMs) &&
    nextRetryAtMs <= Date.now()
  );
}

async function evaluateEligibleFactoryRotationRuns(github, branch) {
  for (const environment of FACTORY_ENVIRONMENTS) {
    const entries = await readFactoryRotationRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

    for (const entry of entries) {
      if (!isEligibleForRotationEvaluationIndexEntry(entry)) {
        continue;
      }

      try {
        const run = await readFactoryRotationRunIfPresent(github, environment, entry.rotationName, branch);
        if (!run || !isEligibleForRotationEvaluation(run)) {
          continue;
        }

        const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
        if (!inputRecord) {
          continue;
        }

        const evaluatedAt = new Date().toISOString();
        const workflowRequest = buildNudgeRotationWorkflowRequest(
          { environment, rotationName: run.rotationName },
          run,
          inputRecord,
        );
        await dispatchGameLaunchWorkflow(resolveWorkflowGitHubClient(github, inputRecord, {}), workflowRequest);
        await updateBranchJsonFile(
          github,
          resolveFactoryRotationRunRecordPath(environment, run.rotationName),
          branch,
          (currentRun) => ({
            ...currentRun,
            updatedAt: evaluatedAt,
            evaluation: {
              ...currentRun.evaluation,
              lastEvaluatedAt: evaluatedAt,
              nextEvaluationAt: buildNextTimestamp(
                evaluatedAt,
                Number(currentRun.evaluation?.intervalMinutes || DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES),
              ),
            },
          }),
          `factory-runs: evaluate rotation for ${environment}/${run.rotationName}`,
        );
      } catch (error) {
        logFactoryError("rotation_evaluation_failed", {
          environment,
          rotationName: entry.rotationName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function isEligibleForRotationEvaluation(run) {
  const recovery = resolveFactoryRunRecovery(run);
  const nextEvaluationAtMs = Date.parse(run.evaluation?.nextEvaluationAt || "");

  return (
    run?.kind === "rotation" &&
    run.status !== "complete" &&
    !hasActiveLease(run) &&
    recovery.canContinue === false &&
    Number.isFinite(nextEvaluationAtMs) &&
    nextEvaluationAtMs <= Date.now()
  );
}

function ensureGitHubConfiguration(env) {
  if (!env.GITHUB_TOKEN) {
    throw new HttpError(500, "GITHUB_TOKEN is required");
  }

  if (!env.GITHUB_REPOSITORY) {
    throw new HttpError(500, "GITHUB_REPOSITORY is required");
  }
}

function decodeBase64ToText(value) {
  return new TextDecoder().decode(decodeBase64ToBytes(value));
}

function decodeBase64ToBytes(value) {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function toGitHubHttpError(response, message) {
  const body = await response.text();
  logFactoryError("github_request_failed", {
    message,
    status: response.status,
    githubRequestId: response.headers.get("x-github-request-id"),
    body: truncateForLog(body || response.statusText),
  });
  return new HttpError(response.status, `${message}: ${body || response.statusText}`);
}

function resolveMissingRunMessage(environment, gameName) {
  return `No run exists for ${environment}/${gameName}`;
}

function resolveMissingSeriesRunMessage(environment, seriesName) {
  return `No series run exists for ${environment}/${seriesName}`;
}

function resolveMissingRotationRunMessage(environment, rotationName) {
  return `No rotation run exists for ${environment}/${rotationName}`;
}

function buildNextTimestamp(timestamp, intervalMinutes) {
  return new Date(Date.parse(timestamp) + intervalMinutes * 60_000).toISOString();
}

function logUnexpectedWorkerError(request, error) {
  logFactoryError("worker_request_failed", {
    method: request.method,
    url: request.url,
    error: error instanceof Error ? error.message : String(error),
  });
}

function logFactoryWarning(event, context) {
  console.warn(JSON.stringify({ scope: "factory-worker", level: "warn", event, ...context }));
}

function logFactoryError(event, context) {
  console.error(JSON.stringify({ scope: "factory-worker", level: "error", event, ...context }));
}

function truncateForLog(value, maxLength = 600) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
