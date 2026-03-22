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
 * - FACTORY_ALLOWED_ORIGIN           default: *
 */

const DEFAULT_FACTORY_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_FACTORY_SERIES_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_FACTORY_ROTATION_RUN_RECOVERY_GRACE_MS = 15_000;
const DEFAULT_SERIES_AUTO_RETRY_INTERVAL_MINUTES = 15;
const DEFAULT_INDEXER_LEGENDARY_LEAD_MS = 30 * 60_000;
const DEFAULT_INDEXER_PRO_COOLDOWN_MS = 40 * 60_000;
const DEFAULT_INDEXER_TIER_REQUEST_COOLDOWN_MS = 15 * 60_000;
const FACTORY_WORKER_ADMIN_SECRET_HEADER = "x-factory-admin-secret";
const FACTORY_ENVIRONMENTS = ["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"];
const RECOVERABLE_FACTORY_STEP_IDS = new Set([
  "create-world",
  "wait-for-factory-index",
  "configure-world",
  "grant-lootchest-role",
  "grant-village-pass-role",
  "create-banks",
  "create-indexer",
  "sync-paymaster",
]);
const RECOVERABLE_FACTORY_SERIES_STEP_IDS = new Set([
  "create-series",
  "create-worlds",
  "wait-for-factory-indexes",
  "configure-worlds",
  "grant-lootchest-roles",
  "grant-village-pass-roles",
  "create-banks",
  "create-indexers",
  "sync-paymaster",
]);
const SUPPORTED_INDEXER_TIERS = new Set(["basic", "pro", "legendary", "epic"]);

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

    if (request.method === "POST" && url.pathname === "/api/factory/indexers/tier") {
      requireFactoryWorkerAdminAuthorization(request, env);
      return await handleUpdateFactoryIndexerTier(request, env);
    }

    const runRoute = matchFactoryRunRoute(url.pathname);
    if (runRoute) {
      if (request.method === "GET") {
        return await handleReadFactoryRun(request, runRoute, env);
      }

      if (request.method === "POST" && runRoute.action === "continue") {
        return await handleContinueFactoryRun(request, env, runRoute);
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

      return buildJsonResponse(request, env, { error: "Not found" }, 404);
    }

    return buildJsonResponse(request, env, { error: "Not found" }, 404);
  } catch (error) {
    logUnexpectedWorkerError(request, error);

    if (error instanceof HttpError) {
      return buildJsonResponse(request, env, { error: error.message }, error.status);
    }

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
    devModeOn: body.devModeOn,
    singleRealmMode: body.singleRealmMode,
    twoPlayerMode: body.twoPlayerMode,
    durationSeconds: body.durationSeconds,
    mapConfigOverrides: body.mapConfigOverrides,
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
  const [gameRuns, seriesRuns, rotationRuns] = await Promise.all([
    readFactoryRunsForEnvironment(github, environment, resolveRunStoreBranch(env)),
    readFactorySeriesRunsForEnvironment(github, environment, resolveRunStoreBranch(env)),
    readFactoryRotationRunsForEnvironment(github, environment, resolveRunStoreBranch(env)),
  ]);
  const runs = [...gameRuns, ...seriesRuns, ...rotationRuns];
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

  const workflowRequest = buildContinueWorkflowRequest(route, run, inputRecord, body.launchStep);
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

  const workflowRequest = buildContinueSeriesWorkflowRequest(route, run, inputRecord, body.launchStep);
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
  validateCancelFactorySeriesAutoRetryBody(body);

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

  const workflowRequest = buildContinueRotationWorkflowRequest(route, run, inputRecord, body.launchStep);
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

async function handleUpdateFactoryIndexerTier(request, env) {
  const body = await readJsonBody(request);
  validateFactoryIndexerTierUpdateBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const workflowRun = await dispatchFactoryIndexerTierWorkflow(github, {
    environment: body.environment,
    gameName: body.gameName,
    tier: body.tier,
  });

  await markPendingIndexerTierUpdateForGame(
    github,
    resolveRunStoreBranch(env),
    body.environment,
    body.gameName,
    body.tier,
    new Date().toISOString(),
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
  validateBlitzRegistrationOverrides(body.blitzRegistrationOverrides);
  validatePositiveNumber(body.gameIntervalMinutes, "gameIntervalMinutes");
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

function validateContinueFactoryRunBody(body) {
  if (!body.launchStep) {
    throw new HttpError(400, "launchStep must be provided");
  }

  validateLaunchWorkflowScope(body.launchStep);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueFactorySeriesRunBody(body) {
  if (!body.launchStep) {
    throw new HttpError(400, "launchStep must be provided");
  }

  validateSeriesLaunchWorkflowScope(body.launchStep);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueFactoryRotationRunBody(body) {
  if (!body.launchStep) {
    throw new HttpError(400, "launchStep must be provided");
  }

  validateRotationLaunchWorkflowScope(body.launchStep);
  validateWorkflowRef(body.workflowRef);
}

function validateCancelFactorySeriesAutoRetryBody(body) {
  validateWorkflowRef(body.workflowRef);

  if (body.cancelReason !== undefined && typeof body.cancelReason !== "string") {
    throw new HttpError(400, "cancelReason must be a string");
  }
}

function validateFactoryIndexerTierUpdateBody(body) {
  validateEnvironment(body.environment);
  validateGameName(body.gameName);
  validateIndexerTier(body.tier);
  validateWorkflowRef(body.workflowRef);
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
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    launchStep: normalizedLaunchStep,
  };
}

function buildContinueSeriesWorkflowRequest(route, run, inputRecord, launchStep) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const normalizedLaunchStep = resolveSeriesRecoveryLaunchScope(run, launchStep);
  const environment = inputRecord.environment || rawRequest.environmentId || route.environment;
  const seriesName = inputRecord.seriesName || rawRequest.seriesName || route.seriesName;
  const games = Array.isArray(rawRequest.games) ? rawRequest.games : [];

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
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    autoRetryEnabled: rawRequest.autoRetryEnabled,
    autoRetryIntervalMinutes: rawRequest.autoRetryIntervalMinutes,
    launchStep: normalizedLaunchStep,
  };
}

function buildContinueRotationWorkflowRequest(route, run, inputRecord, launchStep) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const normalizedLaunchStep = resolveRotationRecoveryLaunchScope(run, launchStep);
  const environment = inputRecord.environment || rawRequest.environmentId || route.environment;
  const rotationName = inputRecord.rotationName || rawRequest.rotationName || route.rotationName;

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
    gameIntervalMinutes: rawRequest.gameIntervalMinutes,
    maxGames: rawRequest.maxGames,
    advanceWindowGames: rawRequest.advanceWindowGames,
    evaluationIntervalMinutes: rawRequest.evaluationIntervalMinutes,
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
    autoRetryEnabled: rawRequest.autoRetryEnabled,
    autoRetryIntervalMinutes: rawRequest.autoRetryIntervalMinutes,
    launchStep: normalizedLaunchStep,
  };
}

function buildNudgeRotationWorkflowRequest(route, run, inputRecord) {
  return buildContinueRotationWorkflowRequest(route, run, inputRecord, "full");
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
  if (
    environment !== "slot.blitz" &&
    environment !== "slot.eternum" &&
    environment !== "mainnet.blitz" &&
    environment !== "mainnet.eternum"
  ) {
    throw new HttpError(400, `Unsupported environment "${environment}"`);
  }
}

function validateGameName(gameName) {
  if (!gameName.trim()) {
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
  }
}

function validateLaunchWorkflowScope(scope) {
  if (
    scope !== "full" &&
    scope !== "create-world" &&
    scope !== "wait-for-factory-index" &&
    scope !== "configure-world" &&
    scope !== "grant-lootchest-role" &&
    scope !== "grant-village-pass-role" &&
    scope !== "create-banks" &&
    scope !== "create-indexer" &&
    scope !== "sync-paymaster"
  ) {
    throw new HttpError(400, `Unsupported launch step "${scope}"`);
  }
}

function validateSeriesLaunchWorkflowScope(scope) {
  if (
    scope !== "full" &&
    scope !== "create-series" &&
    scope !== "create-worlds" &&
    scope !== "wait-for-factory-indexes" &&
    scope !== "configure-worlds" &&
    scope !== "grant-lootchest-roles" &&
    scope !== "grant-village-pass-roles" &&
    scope !== "create-banks" &&
    scope !== "create-indexers" &&
    scope !== "sync-paymaster"
  ) {
    throw new HttpError(400, `Unsupported series launch step "${scope}"`);
  }
}

function validateRotationLaunchWorkflowScope(scope) {
  validateSeriesLaunchWorkflowScope(scope);
}

function validateLaunchWorkflowScopeForEnvironment(environment, scope) {
  if (scope === "full") {
    return;
  }

  if (scope === "sync-paymaster" && !environment.startsWith("mainnet.")) {
    throw new HttpError(400, `Launch step "${scope}" is only supported for mainnet environments`);
  }
}

function validateSeriesLaunchWorkflowScopeForEnvironment(environment, scope) {
  if (scope === "full") {
    return;
  }

  if (scope === "sync-paymaster" && !environment.startsWith("mainnet.")) {
    throw new HttpError(400, `Launch step "${scope}" is only supported for mainnet environments`);
  }

  if ((scope === "grant-village-pass-roles" || scope === "create-banks") && !environment.endsWith(".eternum")) {
    throw new HttpError(400, `Launch step "${scope}" is only supported for Eternum environments`);
  }
}

function validateRotationLaunchWorkflowScopeForEnvironment(environment, scope) {
  validateSeriesLaunchWorkflowScopeForEnvironment(environment, scope);
}

function validateIndexerTier(tier) {
  if (typeof tier !== "string" || !SUPPORTED_INDEXER_TIERS.has(tier)) {
    throw new HttpError(400, `Unsupported indexer tier "${tier}"`);
  }
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
    return {
      state: "failed",
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

function buildGameLaunchWorkflowInputs(request) {
  if (request.launchKind === "series") {
    return {
      launch_kind: "series",
      environment: request.environment,
      game_name: "",
      game_start_time: "",
      series_name: request.seriesName,
      series_games_json: JSON.stringify(request.games),
      dev_mode_on: toWorkflowBooleanInput(request.devModeOn),
      single_realm_mode: toWorkflowBooleanInput(request.singleRealmMode),
      two_player_mode: toWorkflowBooleanInput(request.twoPlayerMode),
      duration_seconds: request.durationSeconds ? String(request.durationSeconds) : "",
      map_config_overrides_json: request.mapConfigOverrides ? JSON.stringify(request.mapConfigOverrides) : "",
      blitz_registration_overrides_json: request.blitzRegistrationOverrides
        ? JSON.stringify(request.blitzRegistrationOverrides)
        : "",
      auto_retry_enabled: request.autoRetryEnabled === false ? "false" : "true",
      auto_retry_interval_minutes: request.autoRetryIntervalMinutes ? String(request.autoRetryIntervalMinutes) : "",
      launch_step: request.launchStep,
    };
  }

  if (request.launchKind === "rotation") {
    return {
      launch_kind: "rotation",
      environment: request.environment,
      game_name: "",
      game_start_time: "",
      series_name: "",
      series_games_json: "",
      rotation_name: request.rotationName,
      first_game_start_time: String(request.firstGameStartTime),
      game_interval_minutes: String(request.gameIntervalMinutes),
      max_games: String(request.maxGames),
      advance_window_games: request.advanceWindowGames ? String(request.advanceWindowGames) : "",
      evaluation_interval_minutes: String(request.evaluationIntervalMinutes),
      dev_mode_on: toWorkflowBooleanInput(request.devModeOn),
      single_realm_mode: toWorkflowBooleanInput(request.singleRealmMode),
      two_player_mode: toWorkflowBooleanInput(request.twoPlayerMode),
      duration_seconds: request.durationSeconds ? String(request.durationSeconds) : "",
      map_config_overrides_json: request.mapConfigOverrides ? JSON.stringify(request.mapConfigOverrides) : "",
      blitz_registration_overrides_json: request.blitzRegistrationOverrides
        ? JSON.stringify(request.blitzRegistrationOverrides)
        : "",
      auto_retry_enabled: request.autoRetryEnabled === false ? "false" : "true",
      auto_retry_interval_minutes: request.autoRetryIntervalMinutes ? String(request.autoRetryIntervalMinutes) : "",
      launch_step: request.launchStep,
    };
  }

  return {
    launch_kind: "game",
    environment: request.environment,
    game_name: request.gameName,
    game_start_time: request.gameStartTime,
    series_name: "",
    series_games_json: "",
    rotation_name: "",
    first_game_start_time: "",
    game_interval_minutes: "",
    max_games: "",
    advance_window_games: "",
    evaluation_interval_minutes: "",
    dev_mode_on: toWorkflowBooleanInput(request.devModeOn),
    single_realm_mode: toWorkflowBooleanInput(request.singleRealmMode),
    two_player_mode: toWorkflowBooleanInput(request.twoPlayerMode),
    duration_seconds: request.durationSeconds ? String(request.durationSeconds) : "",
    map_config_overrides_json: request.mapConfigOverrides ? JSON.stringify(request.mapConfigOverrides) : "",
    blitz_registration_overrides_json: request.blitzRegistrationOverrides
      ? JSON.stringify(request.blitzRegistrationOverrides)
      : "",
    auto_retry_enabled: "",
    auto_retry_interval_minutes: "",
    launch_step: request.launchStep,
  };
}

function validateMapConfigOverrides(value) {
  validateNumericOverrideObject(value, "mapConfigOverrides");
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

function validateBlitzRegistrationOverrideEntry(key, value) {
  switch (key) {
    case "registration_count_max":
      validateBlitzRegistrationCountMax(value);
      return;
    case "fee_token":
    case "fee_amount":
      validateBlitzRegistrationStringValue(key, value);
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

function validateBlitzRegistrationStringValue(key, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `blitzRegistrationOverrides.${key} must be a non-empty string`);
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
  const allowedOrigin = env.FACTORY_ALLOWED_ORIGIN || requestOrigin || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,x-factory-admin-secret",
    Vary: "Origin",
  };
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

async function updateBranchJsonFile(github, path, branch, updateValue, commitMessage = `Update ${path}`) {
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

function encodeTextToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function dispatchFactoryIndexerTierWorkflow(github, request) {
  const workflowFile = "factory-torii-deployer.yml";
  const response = await github.fetch(`/repos/${github.repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: github.workflowRef,
      inputs: {
        operation: "update-tier",
        env: request.environment,
        torii_prefix: request.gameName,
        torii_name: request.gameName,
        torii_tier: request.tier,
        launch_request_id: `indexer-tier-${Date.now()}`,
      },
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, "Failed to dispatch factory-torii-deployer workflow");
  }

  return {
    workflowFile,
  };
}

async function handleScheduledFactoryMaintenance(env) {
  const github = createGitHubClient(env);
  const branch = resolveRunStoreBranch(env);
  await retryEligibleFactorySeriesRuns(github, branch);
  await retryEligibleFactoryRotationRuns(github, branch);
  await evaluateEligibleFactoryRotationRuns(github, branch);
  await reconcileFactoryIndexerTiers(github, branch);
}

async function retryEligibleFactorySeriesRuns(github, branch) {
  for (const environment of FACTORY_ENVIRONMENTS) {
    const runs = await readFactorySeriesRunsForEnvironment(github, environment, branch);

    for (const run of runs) {
      if (!isEligibleForSeriesAutoRetry(run)) {
        continue;
      }

      try {
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
    const runs = await readFactoryRotationRunsForEnvironment(github, environment, branch);

    for (const run of runs) {
      if (!isEligibleForRotationAutoRetry(run)) {
        continue;
      }

      try {
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
    const runs = await readFactoryRotationRunsForEnvironment(github, environment, branch);

    for (const run of runs) {
      if (!isEligibleForRotationEvaluation(run)) {
        continue;
      }

      try {
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
          rotationName: run.rotationName,
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

async function reconcileFactoryIndexerTiers(github, branch) {
  for (const environment of FACTORY_ENVIRONMENTS) {
    await reconcileFactoryGameRunIndexerTiers(github, branch, environment);
    await reconcileFactorySeriesRunIndexerTiers(github, branch, environment);
    await reconcileFactoryRotationRunIndexerTiers(github, branch, environment);
  }
}

async function reconcileFactoryGameRunIndexerTiers(github, branch, environment) {
  const runs = await readFactoryRunsForEnvironment(github, environment, branch);

  for (const run of runs) {
    if (!run.artifacts?.indexerCreated) {
      continue;
    }

    const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
    const timing = resolveGameRunTiming(run, inputRecord);
    const desiredTier = resolveDesiredIndexerTier({
      startTime: timing.startTime,
      durationSeconds: timing.durationSeconds,
      currentTier: run.artifacts?.indexerTier,
    });

    if (!desiredTier || desiredTier === run.artifacts?.indexerTier) {
      continue;
    }

    if (hasRecentPendingIndexerTierUpdate(run.artifacts, desiredTier)) {
      continue;
    }

    const requestedAt = new Date().toISOString();
    await dispatchFactoryIndexerTierWorkflow(github, {
      environment,
      gameName: run.gameName,
      tier: desiredTier,
    });

    await markPendingIndexerTierUpdateForGame(github, branch, environment, run.gameName, desiredTier, requestedAt);
  }
}

async function reconcileFactorySeriesRunIndexerTiers(github, branch, environment) {
  const runs = await readFactorySeriesRunsForEnvironment(github, environment, branch);

  for (const run of runs) {
    const updatedGames = [];
    let hasChanges = false;

    for (const game of run.summary?.games || []) {
      if (!game.artifacts?.indexerCreated) {
        updatedGames.push(game);
        continue;
      }

      const desiredTier = resolveDesiredIndexerTier({
        startTime: game.startTime,
        durationSeconds: game.durationSeconds,
        currentTier: game.artifacts?.indexerTier,
      });

      if (!desiredTier || desiredTier === game.artifacts?.indexerTier) {
        updatedGames.push(game);
        continue;
      }

      if (hasRecentPendingIndexerTierUpdate(game.artifacts, desiredTier)) {
        updatedGames.push(game);
        continue;
      }

      const requestedAt = new Date().toISOString();
      await dispatchFactoryIndexerTierWorkflow(github, {
        environment,
        gameName: game.gameName,
        tier: desiredTier,
      });

      updatedGames.push({
        ...game,
        artifacts: {
          ...game.artifacts,
          pendingIndexerTierTarget: desiredTier,
          pendingIndexerTierRequestedAt: requestedAt,
        },
      });
      hasChanges = true;
    }

    if (!hasChanges) {
      continue;
    }

    await updateBranchJsonFile(
      github,
      resolveFactorySeriesRunRecordPath(environment, run.seriesName),
      branch,
      (currentRun) => ({
        ...currentRun,
        updatedAt: new Date().toISOString(),
        summary: {
          ...currentRun.summary,
          games: updatedGames,
        },
      }),
      `factory-runs: scale series indexer tiers for ${environment}/${run.seriesName}`,
    );
  }
}

async function reconcileFactoryRotationRunIndexerTiers(github, branch, environment) {
  const runs = await readFactoryRotationRunsForEnvironment(github, environment, branch);

  for (const run of runs) {
    const updatedGames = [];
    let hasChanges = false;

    for (const game of run.summary?.games || []) {
      if (!game.artifacts?.indexerCreated) {
        updatedGames.push(game);
        continue;
      }

      const desiredTier = resolveDesiredIndexerTier({
        startTime: game.startTime,
        durationSeconds: game.durationSeconds,
        currentTier: game.artifacts?.indexerTier,
      });

      if (!desiredTier || desiredTier === game.artifacts?.indexerTier) {
        updatedGames.push(game);
        continue;
      }

      if (hasRecentPendingIndexerTierUpdate(game.artifacts, desiredTier)) {
        updatedGames.push(game);
        continue;
      }

      const requestedAt = new Date().toISOString();
      await dispatchFactoryIndexerTierWorkflow(github, {
        environment,
        gameName: game.gameName,
        tier: desiredTier,
      });

      updatedGames.push({
        ...game,
        artifacts: buildPendingIndexerTierArtifacts(game.artifacts, desiredTier, requestedAt),
      });
      hasChanges = true;
    }

    if (!hasChanges) {
      continue;
    }

    await updateBranchJsonFile(
      github,
      resolveFactoryRotationRunRecordPath(environment, run.rotationName),
      branch,
      (currentRun) => ({
        ...currentRun,
        updatedAt: new Date().toISOString(),
        summary: {
          ...currentRun.summary,
          games: updatedGames,
        },
      }),
      `factory-runs: scale rotation indexer tiers for ${environment}/${run.rotationName}`,
    );
  }
}

function resolveGameRunTiming(run, inputRecord) {
  const rawRequest = resolveLaunchInputRequest(inputRecord);
  const startTime = rawRequest.startTime || inputRecord?.startTime;
  const parsedStartTime = parseLaunchStartTime(startTime);

  return {
    startTime: parsedStartTime,
    durationSeconds: run.artifacts?.durationSeconds ?? rawRequest.durationSeconds,
  };
}

function parseLaunchStartTime(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue > 1_000_000_000_000 ? Math.floor(numericValue / 1000) : Math.floor(numericValue);
    }

    const parsedAtMs = Date.parse(value);
    if (Number.isFinite(parsedAtMs)) {
      return Math.floor(parsedAtMs / 1000);
    }
  }

  return null;
}

function resolveDesiredIndexerTier({ startTime, durationSeconds, currentTier }) {
  if (!Number.isFinite(startTime)) {
    return null;
  }

  const nowMs = Date.now();
  const startAtMs = startTime * 1000;
  const legendaryWindowStartMs = startAtMs - DEFAULT_INDEXER_LEGENDARY_LEAD_MS;

  if (nowMs >= legendaryWindowStartMs && nowMs < startAtMs) {
    return "legendary";
  }

  if (Number.isFinite(durationSeconds)) {
    const gameEndMs = startAtMs + durationSeconds * 1000;
    if (nowMs < gameEndMs + DEFAULT_INDEXER_PRO_COOLDOWN_MS) {
      return nowMs >= legendaryWindowStartMs ? "legendary" : null;
    }

    return "pro";
  }

  return null;
}

function hasRecentPendingIndexerTierUpdate(artifacts, desiredTier) {
  if (!artifacts?.pendingIndexerTierTarget || artifacts.pendingIndexerTierTarget !== desiredTier) {
    return false;
  }

  const requestedAtMs = Date.parse(artifacts.pendingIndexerTierRequestedAt || "");
  if (!Number.isFinite(requestedAtMs)) {
    return false;
  }

  return Date.now() - requestedAtMs < DEFAULT_INDEXER_TIER_REQUEST_COOLDOWN_MS;
}

function buildPendingIndexerTierArtifacts(artifacts, tier, requestedAt) {
  return {
    ...artifacts,
    pendingIndexerTierTarget: tier,
    pendingIndexerTierRequestedAt: requestedAt,
  };
}

async function markPendingIndexerTierUpdateForGame(github, branch, environment, gameName, tier, requestedAt) {
  const gameRun = await readFactoryRunIfPresent(github, environment, gameName, branch);

  if (gameRun) {
    await updateBranchJsonFile(
      github,
      resolveFactoryRunRecordPath(environment, gameName),
      branch,
      (currentRun) => ({
        ...currentRun,
        updatedAt: new Date().toISOString(),
        artifacts: buildPendingIndexerTierArtifacts(currentRun.artifacts, tier, requestedAt),
      }),
      `factory-runs: record pending indexer tier for ${environment}/${gameName}`,
    );
    return true;
  }

  const seriesRuns = await readFactorySeriesRunsForEnvironment(github, environment, branch);
  const matchingSeriesRun = seriesRuns.find((run) =>
    (run.summary?.games || []).some((game) => game.gameName === gameName),
  );

  if (matchingSeriesRun) {
    await updateBranchJsonFile(
      github,
      resolveFactorySeriesRunRecordPath(environment, matchingSeriesRun.seriesName),
      branch,
      (currentRun) => ({
        ...currentRun,
        updatedAt: new Date().toISOString(),
        summary: {
          ...currentRun.summary,
          games: currentRun.summary.games.map((game) =>
            game.gameName === gameName
              ? {
                  ...game,
                  artifacts: buildPendingIndexerTierArtifacts(game.artifacts, tier, requestedAt),
                }
              : game,
          ),
        },
      }),
      `factory-runs: record pending series indexer tier for ${environment}/${gameName}`,
    );

    return true;
  }

  const rotationRuns = await readFactoryRotationRunsForEnvironment(github, environment, branch);
  const matchingRotationRun = rotationRuns.find((run) =>
    (run.summary?.games || []).some((game) => game.gameName === gameName),
  );

  if (!matchingRotationRun) {
    return false;
  }

  await updateBranchJsonFile(
    github,
    resolveFactoryRotationRunRecordPath(environment, matchingRotationRun.rotationName),
    branch,
    (currentRun) => ({
      ...currentRun,
      updatedAt: new Date().toISOString(),
      summary: {
        ...currentRun.summary,
        games: currentRun.summary.games.map((game) =>
          game.gameName === gameName
            ? {
                ...game,
                artifacts: buildPendingIndexerTierArtifacts(game.artifacts, tier, requestedAt),
              }
            : game,
        ),
      },
    }),
    `factory-runs: record pending rotation indexer tier for ${environment}/${gameName}`,
  );

  return true;
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
