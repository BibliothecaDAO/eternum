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

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return buildCorsPreflightResponse(request, env);
    }

    if (!isAuthorizedRequest(request, env)) {
      return buildJsonResponse(request, env, { error: "Unauthorized" }, 401);
    }

    if (request.method === "GET" && url.pathname === "/api/factory/runs") {
      return handleListFactoryRuns(request, url, env);
    }

    if (request.method === "POST" && url.pathname === "/api/factory/runs") {
      return handleCreateFactoryRun(request, env);
    }

    const runRoute = matchFactoryRunRoute(url.pathname);
    if (!runRoute) {
      return buildJsonResponse(request, env, { error: "Not found" }, 404);
    }

    if (request.method === "GET") {
      return handleReadFactoryRun(request, runRoute, env);
    }

    if (request.method === "POST" && runRoute.action === "continue") {
      return handleContinueFactoryRun(request, env, runRoute);
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
        run: existingRun,
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
  const runs = await readFactoryRunsForEnvironment(github, environment, resolveRunStoreBranch(env));
  return buildJsonResponse(request, env, { runs }, 200);
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
        run,
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

  return buildJsonResponse(request, env, run, 200);
}

function validateCreateFactoryRunBody(body) {
  validateEnvironment(body.environment);
  validateGameName(body.gameName);
  validateWorkflowRef(body.workflowRef);

  if (!body.gameStartTime?.trim()) {
    throw new HttpError(400, "gameStartTime is required");
  }
}

function validateContinueFactoryRunBody(body) {
  if (!body.launchStep) {
    throw new HttpError(400, "launchStep must be provided");
  }

  validateLaunchWorkflowScope(body.launchStep);
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
    launchStep: normalizedLaunchStep,
  };
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
  if (environment !== "slot.blitz" && environment !== "slot.eternum") {
    throw new HttpError(400, `Unsupported environment "${environment}"`);
  }
}

function validateGameName(gameName) {
  if (!gameName.trim()) {
    throw new HttpError(400, "gameName is required");
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
    scope !== "create-indexer"
  ) {
    throw new HttpError(400, `Unsupported launch step "${scope}"`);
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

function isAuthorizedRequest(request, env) {
  return true;
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

async function readFactoryRunIfPresent(github, environment, gameName, branch) {
  const path = resolveFactoryRunRecordPath(environment, gameName);
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
      inputs: {
        environment: request.environment,
        game_name: request.gameName,
        game_start_time: request.gameStartTime,
        dev_mode_on: toWorkflowBooleanInput(request.devModeOn),
        single_realm_mode: toWorkflowBooleanInput(request.singleRealmMode),
        two_player_mode: toWorkflowBooleanInput(request.twoPlayerMode),
        duration_seconds: request.durationSeconds ? String(request.durationSeconds) : "",
        launch_step: request.launchStep,
      },
    }),
  });

  if (!response.ok) {
    throw await toGitHubHttpError(response, "Failed to dispatch game-launch workflow");
  }

  return {
    workflowFile: github.workflowFile,
  };
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
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
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
