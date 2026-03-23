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
const GAME_PRIZE_FUNDING_STEP_ID = "configure-world";
const SERIES_LIKE_PRIZE_FUNDING_STEP_ID = "configure-worlds";
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

      if (request.method === "POST" && runRoute.action === "fund-prize") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleFundFactoryGamePrize(request, env, runRoute);
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

      if (request.method === "POST" && seriesRunRoute.action === "fund-prize") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleFundFactorySeriesPrizes(request, env, seriesRunRoute);
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

      if (request.method === "POST" && rotationRunRoute.action === "fund-prize") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleFundFactoryRotationPrizes(request, env, rotationRunRoute);
      }

      if (request.method === "POST" && rotationRunRoute.action === "cancel-auto-retry") {
        requireFactoryWorkerAdminAuthorization(request, env);
        return await handleCancelFactoryRotationAutoRetry(request, env, rotationRunRoute);
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

async function handleFundFactoryGamePrize(request, env, route) {
  const body = await readJsonBody(request);
  validateFactoryPrizeFundingBody(body);

  const github = createGitHubClient(env, body.workflowRef);
  const branch = resolveRunStoreBranch(env);
  const run = await readFactoryRunIfPresent(github, route.environment, route.gameName, branch);

  if (!run) {
    return buildJsonResponse(request, env, { error: resolveMissingRunMessage(route.environment, route.gameName) }, 404);
  }

  assertFactoryGameRunReadyForPrizeFunding(run);

  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);
  if (!inputRecord) {
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const workflowRun = await dispatchFactoryPrizeFundingWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    {
      environment: route.environment,
      runKind: "game",
      runName: route.gameName,
      amount: body.amount.trim(),
      selectedGameNames: [],
    },
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

  const workflowRequest = buildContinueSeriesWorkflowRequest(route, run, inputRecord, body.launchStep, body.gameNames);
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

async function handleFundFactorySeriesPrizes(request, env, route) {
  const body = await readJsonBody(request);
  validateFactorySeriesPrizeFundingBody(body);

  const github = createGitHubClient(env, body.workflowRef);
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

  assertFactorySeriesLikeRunReadyForPrizeFunding(run);
  const selectedGameNames = resolveSelectedPrizeFundingGameNames(run, body.gameNames);
  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);

  if (!inputRecord) {
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const workflowRun = await dispatchFactoryPrizeFundingWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    {
      environment: route.environment,
      runKind: "series",
      runName: route.seriesName,
      amount: body.amount.trim(),
      selectedGameNames,
    },
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      selectedGameNames,
      workflowRun,
    },
    202,
  );
}

async function handleFundFactoryRotationPrizes(request, env, route) {
  const body = await readJsonBody(request);
  validateFactorySeriesPrizeFundingBody(body);

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

  assertFactorySeriesLikeRunReadyForPrizeFunding(run);
  const selectedGameNames = resolveSelectedPrizeFundingGameNames(run, body.gameNames);
  const inputRecord = await readFactoryLaunchInputIfPresent(github, run.inputPath, branch);

  if (!inputRecord) {
    return buildJsonResponse(request, env, { error: `No launch input exists at ${run.inputPath}` }, 404);
  }

  const workflowRun = await dispatchFactoryPrizeFundingWorkflow(
    resolveWorkflowGitHubClient(github, inputRecord, body),
    {
      environment: route.environment,
      runKind: "rotation",
      runName: route.rotationName,
      amount: body.amount.trim(),
      selectedGameNames,
    },
  );

  return buildJsonResponse(
    request,
    env,
    {
      accepted: true,
      selectedGameNames,
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

  const workflowRequest = buildContinueRotationWorkflowRequest(
    route,
    run,
    inputRecord,
    body.launchStep,
    body.gameNames,
  );
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

  const branch = resolveRunStoreBranch(env);
  const github = createGitHubClient(env, body.workflowRef);
  const run = await readFactoryRunIfPresent(github, body.environment, body.gameName, branch);
  const inputRecord = run?.inputPath ? await readFactoryLaunchInputIfPresent(github, run.inputPath, branch) : null;
  const workflowRun = await dispatchFactoryIndexerTierWorkflow(
    resolveIndexerTierWorkflowGitHubClient(github, run, inputRecord, body.workflowRef),
    {
      environment: body.environment,
      gameName: body.gameName,
      tier: body.tier,
    },
  );

  await markPendingIndexerTierUpdateForGame(
    github,
    branch,
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
  validateContinueTargetGameNames(body.gameNames, body.launchStep);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueFactoryRotationRunBody(body) {
  if (!body.launchStep) {
    throw new HttpError(400, "launchStep must be provided");
  }

  validateRotationLaunchWorkflowScope(body.launchStep);
  validateContinueTargetGameNames(body.gameNames, body.launchStep);
  validateWorkflowRef(body.workflowRef);
}

function validateContinueTargetGameNames(gameNames, launchStep) {
  if (gameNames === undefined) {
    return;
  }

  validatePrizeFundingGameNames(gameNames);

  if (launchStep !== "create-indexers") {
    throw new HttpError(400, 'gameNames is only supported when launchStep is "create-indexers"');
  }
}

function validateCancelFactoryAutoRetryBody(body) {
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

function validateFactoryPrizeFundingBody(body) {
  validateWorkflowRef(body.workflowRef);

  if (typeof body.amount !== "string" || !body.amount.trim()) {
    throw new HttpError(400, "amount is required");
  }
}

function validateFactorySeriesPrizeFundingBody(body) {
  validateFactoryPrizeFundingBody(body);

  if (body.gameNames !== undefined) {
    validatePrizeFundingGameNames(body.gameNames);
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
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
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
    devModeOn: rawRequest.devModeOn,
    singleRealmMode: rawRequest.singleRealmMode,
    twoPlayerMode: rawRequest.twoPlayerMode,
    durationSeconds: rawRequest.durationSeconds,
    mapConfigOverrides: rawRequest.mapConfigOverrides,
    blitzRegistrationOverrides: rawRequest.blitzRegistrationOverrides,
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
    targetGameNames,
    launchStep: normalizedLaunchStep,
  };
}

function buildNudgeRotationWorkflowRequest(route, run, inputRecord) {
  return buildContinueRotationWorkflowRequest(route, run, inputRecord, "full");
}

function resolveContinueTargetGameNames(games, requestedGameNames, launchStep, context) {
  if (requestedGameNames === undefined) {
    return undefined;
  }

  if (launchStep !== "create-indexers") {
    throw new HttpError(400, 'gameNames is only supported when launchStep resolves to "create-indexers"');
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

function resolveGamePrizeFundingReadiness(run) {
  if (!run.artifacts?.worldAddress) {
    return {
      ready: false,
      reason: `Game "${run.gameName}" is missing a world address`,
    };
  }

  if (!hasSucceededRunStep(run.steps, GAME_PRIZE_FUNDING_STEP_ID)) {
    return {
      ready: false,
      reason: `Game "${run.gameName}" must finish world configuration before prize funding`,
    };
  }

  return { ready: true };
}

function resolveSeriesLikeGamePrizeFundingReadiness(game) {
  if (!game.artifacts?.worldAddress) {
    return {
      ready: false,
      reason: `Game "${game.gameName}" is missing a world address`,
    };
  }

  if (!hasSucceededSeriesLikeGameStep(game.steps, SERIES_LIKE_PRIZE_FUNDING_STEP_ID)) {
    return {
      ready: false,
      reason: `Game "${game.gameName}" must finish world configuration before prize funding`,
    };
  }

  return { ready: true };
}

function resolveDefaultSeriesLikePrizeFundingGameNames(run) {
  return run.summary.games
    .filter((game) => {
      const readiness = resolveSeriesLikeGamePrizeFundingReadiness(game);
      return readiness.ready && (game.artifacts?.prizeFunding?.transfers?.length ?? 0) === 0;
    })
    .map((game) => game.gameName);
}

function resolveSelectedSeriesLikePrizeFundingGameNames(run, requestedGameNames) {
  const selectedGameNames =
    requestedGameNames.length > 0 ? requestedGameNames : resolveDefaultSeriesLikePrizeFundingGameNames(run);

  if (selectedGameNames.length === 0) {
    throw new Error(`No eligible unfunded games are ready in "${resolveSeriesLikeRunName(run)}"`);
  }

  const selectedGameNameSet = new Set(selectedGameNames);
  const orderedGames = run.summary.games.filter((game) => selectedGameNameSet.has(game.gameName));

  if (orderedGames.length !== selectedGameNameSet.size) {
    throw new Error(`One or more selected games were not found in "${resolveSeriesLikeRunName(run)}"`);
  }

  for (const game of orderedGames) {
    const readiness = resolveSeriesLikeGamePrizeFundingReadiness(game);

    if (!readiness.ready) {
      throw new Error(readiness.reason ?? `Game "${game.gameName}" is not ready for prize funding`);
    }
  }

  return orderedGames.map((game) => game.gameName);
}

function assertFactoryGameRunReadyForPrizeFunding(run) {
  const readiness = resolveGamePrizeFundingReadiness(run);

  if (!readiness.ready) {
    throw new HttpError(409, readiness.reason ?? `Game "${run.gameName}" is not ready for prize funding`);
  }
}

function assertFactorySeriesLikeRunReadyForPrizeFunding(run) {
  if (!Array.isArray(run.summary?.games) || run.summary.games.length === 0) {
    throw new HttpError(
      409,
      `${resolveSeriesLikeRunLabel(run)} "${resolveSeriesLikeRunName(run)}" does not have any games ready for prize funding`,
    );
  }
}

function resolveSelectedPrizeFundingGameNames(run, requestedGameNames) {
  try {
    return resolveSelectedSeriesLikePrizeFundingGameNames(
      run,
      normalizeRequestedPrizeFundingGameNames(requestedGameNames),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prize funding selection is invalid";
    throw new HttpError(resolvePrizeFundingSelectionErrorStatus(message), message);
  }
}

function normalizeRequestedPrizeFundingGameNames(requestedGameNames) {
  return Array.isArray(requestedGameNames) ? requestedGameNames.map((gameName) => gameName.trim()) : [];
}

function resolveSeriesLikeRunLabel(run) {
  return run.kind === "rotation" ? "Rotation" : "Series";
}

function resolveSeriesLikeRunName(run) {
  return run.kind === "rotation" ? run.rotationName : run.seriesName;
}

function resolvePrizeFundingSelectionErrorStatus(message) {
  return message.includes("not found") || message.includes("were not found") ? 400 : 409;
}

function hasSucceededRunStep(steps, stepId) {
  return Array.isArray(steps) && steps.some((step) => step.id === stepId && step.status === "succeeded");
}

function hasSucceededSeriesLikeGameStep(steps, stepId) {
  return Array.isArray(steps) && steps.some((step) => step.id === stepId && step.status === "succeeded");
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

function validatePrizeFundingGameNames(gameNames) {
  if (!Array.isArray(gameNames)) {
    throw new HttpError(400, "gameNames must be an array");
  }

  const seenGameNames = new Set();

  for (const gameName of gameNames) {
    if (typeof gameName !== "string" || !gameName.trim()) {
      throw new HttpError(400, "gameNames must contain non-empty strings");
    }

    const normalizedGameName = gameName.trim();

    if (seenGameNames.has(normalizedGameName)) {
      throw new HttpError(400, `Prize funding game "${normalizedGameName}" was requested more than once`);
    }

    seenGameNames.add(normalizedGameName);
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

function hasPendingIndexerTierForGameIndexEntry(entry) {
  if (!entry?.artifacts?.indexerCreated) {
    return false;
  }

  return Boolean(
    resolvePendingIndexerTierTarget({
      startTime: parseLaunchStartTime(entry.startTime),
      durationSeconds: entry.durationSeconds,
      artifacts: entry.artifacts,
    }),
  );
}

function hasPendingIndexerTierForSeriesLikeIndexEntry(entry) {
  return (entry.games || []).some((game) =>
    resolvePendingIndexerTierTarget({
      startTime: parseLaunchStartTime(game.startTime),
      durationSeconds: game.durationSeconds,
      artifacts: game.artifacts,
    }),
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
    parts[6] === "fund-prize"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const gameName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, gameName, action: "fund-prize" };
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
    parts[6] === "fund-prize"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const seriesName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, seriesName, action: "fund-prize" };
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

  if (
    parts.length === 7 &&
    parts[0] === "api" &&
    parts[1] === "factory" &&
    parts[2] === "rotation-runs" &&
    parts[5] === "actions" &&
    parts[6] === "fund-prize"
  ) {
    const environment = decodeURIComponent(parts[3]);
    const rotationName = decodeURIComponent(parts[4]);
    validateEnvironment(environment);
    return { environment, rotationName, action: "fund-prize" };
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

function buildFactoryMaintenanceArtifactsSnapshot(artifacts) {
  return {
    indexerCreated: artifacts?.indexerCreated,
    indexerTier: artifacts?.indexerTier,
    pendingIndexerTierTarget: artifacts?.pendingIndexerTierTarget,
    pendingIndexerTierRequestedAt: artifacts?.pendingIndexerTierRequestedAt,
  };
}

function buildFactoryMaintenanceGame(game) {
  return {
    gameName: game.gameName,
    startTime: game.startTime,
    durationSeconds: game.durationSeconds,
    artifacts: buildFactoryMaintenanceArtifactsSnapshot(game.artifacts),
  };
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
    startTime: run.artifacts?.scheduledStartTime,
    durationSeconds: run.artifacts?.durationSeconds,
    artifacts: buildFactoryMaintenanceArtifactsSnapshot(run.artifacts),
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
    games: (run.summary?.games || []).map(buildFactoryMaintenanceGame),
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
    games: (run.summary?.games || []).map(buildFactoryMaintenanceGame),
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

async function dispatchFactoryPrizeFundingWorkflow(github, request) {
  const workflowFile = "factory-prize-funding.yml";
  const response = await github.fetch(`/repos/${github.repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: github.workflowRef,
      inputs: {
        environment: request.environment,
        run_kind: request.runKind,
        run_name: request.runName,
        prize_amount: request.amount,
        selected_games_json: request.selectedGameNames.length > 0 ? JSON.stringify(request.selectedGameNames) : "",
      },
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, "Failed to dispatch factory-prize-funding workflow");
  }

  return {
    workflowFile,
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
      target_game_names_json: request.targetGameNames?.length ? JSON.stringify(request.targetGameNames) : "",
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
      target_game_names_json: request.targetGameNames?.length ? JSON.stringify(request.targetGameNames) : "",
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
    target_game_names_json: "",
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

function resolveIndexerTierWorkflowGitHubClient(github, run, inputRecord, workflowRefOverride) {
  const workflowRef = workflowRefOverride || inputRecord?.workflow?.ref || run?.workflow?.ref || github.workflowRef;

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
  const entries = await readFactoryGameRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

  for (const entry of entries) {
    if (!hasPendingIndexerTierForGameIndexEntry(entry)) {
      continue;
    }

    try {
      const run = await readFactoryRunIfPresent(github, environment, entry.gameName, branch);
      if (!run) {
        continue;
      }

      await reconcileFactoryGameRunIndexerTier(github, branch, environment, run);
    } catch (error) {
      logFactoryError("game_indexer_tier_reconcile_failed", {
        environment,
        gameName: entry.gameName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function reconcileFactorySeriesRunIndexerTiers(github, branch, environment) {
  const entries = await readFactorySeriesRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

  for (const entry of entries) {
    if (!hasPendingIndexerTierForSeriesLikeIndexEntry(entry)) {
      continue;
    }

    try {
      const run = await readFactorySeriesRunIfPresent(github, environment, entry.seriesName, branch);
      if (!run) {
        continue;
      }

      await reconcileFactorySeriesRunIndexerTier(github, branch, environment, run);
    } catch (error) {
      logFactoryError("series_indexer_tier_reconcile_failed", {
        environment,
        seriesName: entry.seriesName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function reconcileFactoryRotationRunIndexerTiers(github, branch, environment) {
  const entries = await readFactoryRotationRunMaintenanceIndexEntriesForEnvironment(github, environment, branch);

  for (const entry of entries) {
    if (!hasPendingIndexerTierForSeriesLikeIndexEntry(entry)) {
      continue;
    }

    try {
      const run = await readFactoryRotationRunIfPresent(github, environment, entry.rotationName, branch);
      if (!run) {
        continue;
      }

      await reconcileFactoryRotationRunIndexerTier(github, branch, environment, run);
    } catch (error) {
      logFactoryError("rotation_indexer_tier_reconcile_failed", {
        environment,
        rotationName: entry.rotationName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function reconcileFactoryGameRunIndexerTier(github, branch, environment, run) {
  if (!run.artifacts?.indexerCreated) {
    return;
  }

  const timing = resolveGameRunTiming(run);
  const desiredTier = resolvePendingIndexerTierTarget({
    startTime: timing.startTime,
    durationSeconds: timing.durationSeconds,
    artifacts: run.artifacts,
  });

  if (!desiredTier) {
    return;
  }

  const dispatchResult = await requestIndexerTierDispatch(
    resolveIndexerTierWorkflowGitHubClient(github, run, null),
    {
      environment,
      gameName: run.gameName,
      tier: desiredTier,
    },
    {
      runKind: "game",
      runName: run.gameName,
      environment,
      gameName: run.gameName,
      tier: desiredTier,
    },
  );

  if (!dispatchResult.errorMessage) {
    await markPendingIndexerTierUpdateForGame(
      github,
      branch,
      environment,
      run.gameName,
      desiredTier,
      dispatchResult.at,
    );
    return;
  }

  await markIndexerTierDispatchFailureForGame(
    github,
    branch,
    environment,
    run.gameName,
    desiredTier,
    dispatchResult.at,
    dispatchResult.errorMessage,
  );
}

async function reconcileFactorySeriesRunIndexerTier(github, branch, environment, run) {
  const workflowGitHub = resolveIndexerTierWorkflowGitHubClient(github, run, null);
  const updatedGames = [];
  let hasChanges = false;

  for (const game of run.summary?.games || []) {
    const result = await reconcileSeriesLikeGameIndexerTier(workflowGitHub, environment, run, game);
    updatedGames.push(result.game);
    hasChanges = hasChanges || result.didUpdate;
  }

  if (!hasChanges) {
    return;
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

async function reconcileFactoryRotationRunIndexerTier(github, branch, environment, run) {
  const workflowGitHub = resolveIndexerTierWorkflowGitHubClient(github, run, null);
  const updatedGames = [];
  let hasChanges = false;

  for (const game of run.summary?.games || []) {
    const result = await reconcileSeriesLikeGameIndexerTier(workflowGitHub, environment, run, game);
    updatedGames.push(result.game);
    hasChanges = hasChanges || result.didUpdate;
  }

  if (!hasChanges) {
    return;
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

async function reconcileSeriesLikeGameIndexerTier(github, environment, run, game) {
  if (!game.artifacts?.indexerCreated) {
    return {
      game,
      didUpdate: false,
    };
  }

  const desiredTier = resolvePendingIndexerTierTarget({
    startTime: parseLaunchStartTime(game.startTime),
    durationSeconds: game.durationSeconds,
    artifacts: game.artifacts,
  });

  if (!desiredTier) {
    return {
      game,
      didUpdate: false,
    };
  }

  const dispatchResult = await requestIndexerTierDispatch(
    github,
    {
      environment,
      gameName: game.gameName,
      tier: desiredTier,
    },
    {
      runKind: run.kind,
      runName: run.seriesName || run.rotationName,
      environment,
      gameName: game.gameName,
      tier: desiredTier,
    },
  );

  return {
    game: {
      ...game,
      artifacts: dispatchResult.errorMessage
        ? buildIndexerTierDispatchFailureArtifacts(
            game.artifacts,
            desiredTier,
            dispatchResult.at,
            dispatchResult.errorMessage,
          )
        : buildPendingIndexerTierArtifacts(game.artifacts, desiredTier, dispatchResult.at),
    },
    didUpdate: true,
  };
}

async function requestIndexerTierDispatch(github, request, context) {
  const at = new Date().toISOString();

  try {
    await dispatchFactoryIndexerTierWorkflow(github, request);

    return {
      at,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logFactoryError("indexer_tier_dispatch_failed", {
      ...context,
      workflowRef: github.workflowRef,
      message: errorMessage,
    });

    return {
      at,
      errorMessage,
    };
  }
}

function resolveGameRunTiming(run, inputRecord = null) {
  const rawRequest = inputRecord ? resolveLaunchInputRequest(inputRecord) : {};
  const startTime = run.artifacts?.scheduledStartTime ?? rawRequest.startTime ?? inputRecord?.startTime;
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

function resolvePendingIndexerTierTarget({ startTime, durationSeconds, artifacts }) {
  const desiredTier = resolveDesiredIndexerTier({
    startTime,
    durationSeconds,
    currentTier: artifacts?.indexerTier,
  });

  if (!desiredTier || desiredTier === artifacts?.indexerTier) {
    return null;
  }

  if (hasRecentPendingIndexerTierUpdate(artifacts, desiredTier)) {
    return null;
  }

  return desiredTier;
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
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function buildIndexerTierDispatchFailureArtifacts(artifacts, tier, failedAt, errorMessage) {
  return {
    ...artifacts,
    lastIndexerTierDispatchTarget: tier,
    lastIndexerTierDispatchFailedAt: failedAt,
    lastIndexerTierDispatchError: errorMessage,
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

async function markIndexerTierDispatchFailureForGame(
  github,
  branch,
  environment,
  gameName,
  tier,
  failedAt,
  errorMessage,
) {
  const gameRun = await readFactoryRunIfPresent(github, environment, gameName, branch);

  if (!gameRun) {
    return false;
  }

  await updateBranchJsonFile(
    github,
    resolveFactoryRunRecordPath(environment, gameName),
    branch,
    (currentRun) => ({
      ...currentRun,
      updatedAt: new Date().toISOString(),
      artifacts: buildIndexerTierDispatchFailureArtifacts(currentRun.artifacts, tier, failedAt, errorMessage),
    }),
    `factory-runs: record indexer tier dispatch failure for ${environment}/${gameName}`,
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
