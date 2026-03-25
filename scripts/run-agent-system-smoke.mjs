const gatewayUrl = process.env.AGENT_GATEWAY_URL ?? "http://127.0.0.1:8787";
const executorUrl = process.env.AGENT_EXECUTOR_URL ?? "http://127.0.0.1:8788";
const playerId = requireEnv("PLAYER_ID");
const worldId = requireEnv("WORLD_ID");

const options = {
  worldName: process.env.WORLD_NAME,
  chain: process.env.CHAIN ?? "slot",
  rpcUrl: process.env.RPC_URL,
  toriiBaseUrl: process.env.TORII_BASE_URL,
  displayName: process.env.AGENT_DISPLAY_NAME ?? "Smoke Agent",
  modelProvider: process.env.MODEL_PROVIDER ?? "anthropic",
  modelId: process.env.MODEL_ID ?? "claude-sonnet-4-20250514",
  steeringJobType: process.env.STEERING_JOB_TYPE ?? "scout",
  simulateAuth: process.env.SIMULATE_AUTH !== "false",
  forceResetSession: process.env.FORCE_RESET_SESSION === "true",
  heartbeatAttempts: Number(process.env.HEARTBEAT_ATTEMPTS ?? 6),
  heartbeatDelayMs: Number(process.env.HEARTBEAT_DELAY_MS ?? 5_000),
};

await runSmoke();

async function runSmoke() {
  logStep("Checking local services");
  await assertJson(`${gatewayUrl}/my/agents`, {
    headers: buildPlayerHeaders(),
  });
  await assertJson(`${executorUrl}/health`);

  logStep("Resolving or launching the world agent");
  let agent = await findAgentForWorld();
  if (!agent) {
    const launched = await postJson(`${gatewayUrl}/my/agents`, {
      headers: buildPlayerHeaders(),
      body: JSON.stringify({
        worldId,
        worldName: options.worldName,
        chain: options.chain,
        rpcUrl: options.rpcUrl,
        toriiBaseUrl: options.toriiBaseUrl,
        displayName: options.displayName,
        modelProvider: options.modelProvider,
        modelId: options.modelId,
      }),
    });

    console.log(`  launched ${launched.agentId} with status ${launched.status}`);
    agent = launched.detail;
  }

  if (options.forceResetSession && agent.setup.status === "ready") {
    logStep("Resetting the stored session for a clean setup flow");
    agent = await postJson(`${gatewayUrl}/my/agents/${agent.id}/session/reset`, {
      headers: buildPlayerHeaders(),
      body: JSON.stringify({ worldId }),
    });
  }

  if (agent.setup.status === "pending_auth") {
    if (!options.simulateAuth) {
      throw new Error("Agent is pending auth and SIMULATE_AUTH=false. Complete auth manually first.");
    }

    logStep("Completing setup through the local callback contract");
    await completePendingSetup(agent);
    agent = await fetchAgentDetail(agent.id);
  }

  if (agent.setup.status !== "ready") {
    throw new Error(`Agent is not ready. Current setup status: ${agent.setup.status}`);
  }

  logStep("Enabling autonomy");
  agent = await postJson(`${gatewayUrl}/my/agents/${agent.id}/autonomy/enable`, {
    headers: buildPlayerHeaders(),
    body: JSON.stringify({
      worldId,
      steeringJobType: options.steeringJobType,
    }),
  });

  console.log(`  autonomy enabled, execution state ${agent.executionState}`);

  logStep("Driving executor heartbeats and waiting for a run");
  const runResult = await waitForAgentRun(agent.id);

  console.log("");
  console.log("SMOKE RESULT");
  console.log(`  agent: ${agent.id}`);
  console.log(`  setup: ${runResult.detail.setup.status}`);
  console.log(`  execution: ${runResult.detail.executionState}`);
  console.log(`  lastRunFinishedAt: ${runResult.detail.lastRunFinishedAt ?? "none"}`);
  console.log(`  latestError: ${runResult.detail.lastErrorMessage ?? "none"}`);
  console.log(`  recentEvents: ${runResult.events.map((event) => event.type).join(", ") || "none"}`);

  if (!runResult.detail.lastRunFinishedAt && !runResult.detail.lastErrorMessage) {
    throw new Error("No finished run or visible executor error was observed.");
  }
}

async function waitForAgentRun(agentId) {
  for (let attempt = 1; attempt <= options.heartbeatAttempts; attempt += 1) {
    const heartbeat = await postJson(`${executorUrl}/jobs/agent-heartbeat`, {
      method: "POST",
    });
    const detail = await fetchAgentDetail(agentId);
    const events = await fetchAgentEvents(agentId);

    console.log(
      `  heartbeat ${attempt}/${options.heartbeatAttempts}: scanned=${heartbeat.scanned} state=${detail.executionState} lastRun=${detail.lastRunFinishedAt ?? "none"}`,
    );

    if (detail.lastRunFinishedAt || detail.lastErrorMessage) {
      return { detail, events };
    }

    await sleep(options.heartbeatDelayMs);
  }

  return {
    detail: await fetchAgentDetail(agentId),
    events: await fetchAgentEvents(agentId),
  };
}

async function completePendingSetup(agent) {
  if (!agent.setup.authUrl) {
    throw new Error("Pending setup is missing authUrl.");
  }

  const authUrl = new URL(agent.setup.authUrl);
  const redirectUri = new URL(authUrl.searchParams.get("redirect_uri"));
  const redirectHash = new URLSearchParams(redirectUri.hash.replace(/^#/, ""));

  await postJson(`${gatewayUrl}/my/agents/${agent.id}/setup/complete`, {
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      authSessionId: redirectHash.get("authSessionId"),
      state: redirectHash.get("state"),
      startapp: Buffer.from(
        JSON.stringify({
          username: "agent_smoke",
          address: playerId.toLowerCase(),
          ownerGuid: "0x123456",
          expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
        }),
      ).toString("base64"),
    }),
  });
}

async function findAgentForWorld() {
  const payload = await assertJson(`${gatewayUrl}/my/agents`, {
    headers: buildPlayerHeaders(),
  });
  return payload.agents.find((agent) => agent.worldId === worldId) ?? null;
}

async function fetchAgentDetail(agentId) {
  return assertJson(`${gatewayUrl}/my/agents/${agentId}`, {
    headers: buildPlayerHeaders(),
  });
}

async function fetchAgentEvents(agentId) {
  const response = await fetch(`${gatewayUrl}/my/agents/${agentId}/events?afterSeq=0`, {
    headers: buildPlayerHeaders(),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(body || `Event fetch failed with status ${response.status}`);
  }

  return body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
}

function buildPlayerHeaders() {
  return {
    "content-type": "application/json",
    "x-player-id": playerId,
  };
}

async function postJson(url, init = {}) {
  return assertJson(url, {
    method: "POST",
    ...init,
  });
}

async function assertJson(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(body || `Request to ${url} failed with status ${response.status}`);
  }

  return body ? JSON.parse(body) : {};
}

function logStep(label) {
  console.log("");
  console.log(`== ${label}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
