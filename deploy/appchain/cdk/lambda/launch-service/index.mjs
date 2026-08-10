/**
 * Launch service for the appchain factory UI.
 *
 * Phase-1 stand-in for the `realms-game-launch` worker: the client speaks the
 * same /api/factory contract, and this service translates it onto GitHub —
 * launches dispatch `game-launch.yml`, run state is read from the
 * `factory-runs` branch that the workflow maintains. See
 * docs/plans/appchain-phase-1.md (M4).
 */
const GITHUB_API = "https://api.github.com";

const repo = process.env.GITHUB_REPO;
const workflowFile = process.env.WORKFLOW_FILE ?? "game-launch.yml";
const defaultWorkflowRef = process.env.DEFAULT_WORKFLOW_REF ?? "next";
const runStoreBranch = process.env.RUN_STORE_BRANCH ?? "factory-runs";
const allowedEnvironments = new Set(
  (process.env.ALLOWED_ENVIRONMENTS ?? "appchain.blitz,appchain.eternum").split(","),
);
const tokenSecretArn = process.env.GITHUB_TOKEN_SECRET_ARN;

let cachedToken = null;

async function githubToken() {
  if (cachedToken) return cachedToken;

  // Secrets Manager via the Lambda secrets extension-free path: plain API call
  // signed by the execution role. Uses the AWS SDK bundled in the runtime.
  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({ SecretId: tokenSecretArn }));
  const token = (result.SecretString ?? "").trim();
  if (!token) throw new Error("GitHub token secret is empty — put a PAT with actions:write + contents:read in it");
  cachedToken = token;
  return token;
}

async function githubRequest(path, { method = "GET", body } = {}) {
  const token = await githubToken();
  return fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "realms-appchain-launch-service",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

/** environment id "<chain>.<game-type>" → run store path segments. */
function runStorePathSegments(environment) {
  const [chain, gameType] = environment.split(".");
  return { chain, gameType };
}

async function readRunRecord(environment, gameName) {
  const { chain, gameType } = runStorePathSegments(environment);
  const path = `runs/${chain}/${gameType}/${encodeURIComponent(gameName)}.json`;
  const response = await githubRequest(
    `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(runStoreBranch)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`run store read failed: HTTP ${response.status}`);

  const payload = await response.json();
  return JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
}

async function listRunRecords(environment) {
  const { chain, gameType } = runStorePathSegments(environment);
  const response = await githubRequest(
    `/repos/${repo}/contents/runs/${chain}/${gameType}?ref=${encodeURIComponent(runStoreBranch)}`,
  );
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`run store list failed: HTTP ${response.status}`);

  const entries = (await response.json()).filter(
    (entry) => entry.type === "file" && entry.name.endsWith(".json"),
  );
  // Newest runs matter most in the UI; cap the fan-out.
  const limited = entries.slice(-50);
  const records = await Promise.all(
    limited.map(async (entry) => {
      const fileResponse = await githubRequest(
        `/repos/${repo}/contents/${entry.path}?ref=${encodeURIComponent(runStoreBranch)}`,
      );
      if (!fileResponse.ok) return null;
      const payload = await fileResponse.json();
      try {
        return JSON.parse(Buffer.from(payload.content, "base64").toString("utf8"));
      } catch {
        return null;
      }
    }),
  );
  return records.filter(Boolean);
}

function buildLaunchOptions(request) {
  const options = {};
  for (const key of [
    // Registered registrar preset id the game runs on (appchain worlds).
    "version",
    "devModeOn",
    "twoPlayerMode",
    "singleRealmMode",
    "durationSeconds",
    "mapConfigOverrides",
    "biomeClimateOverrides",
    "blitzRegistrationOverrides",
  ]) {
    if (request[key] !== undefined && request[key] !== null) {
      options[key] = request[key];
    }
  }
  return options;
}

async function dispatchGameLaunch(request) {
  if (!request || typeof request !== "object") return json(400, { error: "invalid request body" });
  const { environment, gameName, gameStartTime } = request;
  if (!allowedEnvironments.has(environment)) {
    return json(400, { error: `unsupported environment "${environment}"` });
  }
  if (!gameName || !gameStartTime) {
    return json(400, { error: "gameName and gameStartTime are required" });
  }

  const inputs = {
    launch_kind: "game",
    environment,
    game_name: gameName,
    game_start_time: String(gameStartTime),
    launch_step: "full",
  };
  const launchOptions = buildLaunchOptions(request);
  if (Object.keys(launchOptions).length > 0) {
    inputs.launch_options_json = JSON.stringify(launchOptions);
  }

  const response = await githubRequest(`/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    body: { ref: request.workflowRef ?? defaultWorkflowRef, inputs },
  });

  if (response.status !== 204) {
    const detail = await response.text();
    return json(502, { error: `workflow dispatch failed: HTTP ${response.status} ${detail.slice(0, 300)}` });
  }

  return json(202, { dispatched: true });
}

export async function handler(event) {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";
  const query = event.queryStringParameters ?? {};

  try {
    if (method === "GET" && path === "/api/factory/runs") {
      const environment = query.environment;
      if (!allowedEnvironments.has(environment)) {
        return json(400, { error: `unsupported environment "${environment}"` });
      }
      return json(200, { runs: await listRunRecords(environment) });
    }

    const runMatch = path.match(/^\/api\/factory\/runs\/([^/]+)\/([^/]+)$/);
    if (method === "GET" && runMatch) {
      const environment = decodeURIComponent(runMatch[1]);
      if (!allowedEnvironments.has(environment)) {
        return json(400, { error: `unsupported environment "${environment}"` });
      }
      const record = await readRunRecord(environment, decodeURIComponent(runMatch[2]));
      return record ? json(200, record) : json(404, { error: "run not found" });
    }

    if (method === "POST" && path === "/api/factory/runs") {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : (event.body ?? "");
      let request;
      try {
        request = JSON.parse(body);
      } catch {
        return json(400, { error: "request body must be JSON" });
      }
      return await dispatchGameLaunch(request);
    }

    // Series/rotation runs, funding, indexer tiers, …: not implemented for
    // the appchain phase-1 service. 404 lets the client degrade (it treats
    // missing list/aux endpoints as absent features).
    return json(404, { error: "not found" });
  } catch (error) {
    console.error("launch-service error", error);
    return json(500, { error: String(error?.message ?? error) });
  }
}
