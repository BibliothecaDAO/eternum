import { EternumClient } from "@bibliothecadao/client";
import {
  createHeartbeatLoop,
  createGameAgent,
  type HeartbeatJob,
} from "@bibliothecadao/game-agent";
import { getModel } from "@mariozechner/pi-ai";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { Account, RpcProvider, uint256, CallData, type AccountInterface } from "starknet";
import { createShutdownGate } from "./shutdown-gate";
import { type AgentConfig, loadConfig } from "./config";
import { EternumGameAdapter } from "./adapter/eternum-adapter";
import { MutableGameAdapter } from "./adapter/mutable-adapter";
import { ControllerSession } from "./session";
import { readArtifacts } from "./session/artifacts";
import { createPrivateKeyAccount } from "./session/privatekey-auth";
import { deriveChainIdFromRpcUrl } from "./world/normalize";
import { createInspectTools } from "./tools/inspect-tools";
import { getActionDefinitions } from "./adapter/action-registry";
import { formatEternumTickPrompt, type EternumWorldState } from "./adapter/world-state";
import { JsonEmitter } from "./output/json-emitter";
import { createApiServer } from "./api/server";
import { startStdinReader } from "./input/stdin-reader";
import type { CliOptions } from "./cli-args";
import { seedDataDir } from "./cli";
import { createRuntimeConfigManager } from "./runtime-config";

function loadReferenceHandbooks(dataDir: string): string {
  const taskDir = path.join(dataDir, "tasks");
  if (!existsSync(taskDir)) return "";

  const sections: string[] = [];
  let files: string[];
  try {
    files = readdirSync(taskDir).filter((f: string) => f.endsWith(".md")).sort();
  } catch {
    return "";
  }

  for (const file of files) {
    const raw = readFileSync(path.join(taskDir, file), "utf-8");
    const autoloadMatch = raw.match(/^---\n[\s\S]*?autoload:\s*(true|false)[\s\S]*?\n---/);
    if (autoloadMatch && autoloadMatch[1] === "true") continue;
    if (!raw.startsWith("---\n")) continue;

    const domain = file.replace(/\.md$/, "");
    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
    if (content) {
      sections.push(`<reference domain="${domain}">\n${content}\n</reference>`);
    }
  }

  if (sections.length === 0) return "";
  return `## Reference Handbooks (study these before acting)\n\n${sections.join("\n\n")}`;
}

/**
 * Auto top-up fee tokens from master account on non-mainnet chains.
 * Mirrors the game client's auto-top-up in use-world-registration.ts.
 */
async function autoTopUpFeeTokens(
  rpcUrl: string,
  toriiBaseUrl: string,
  agentAddress: string,
  feeTokenAddress: string | undefined,
  emitter: JsonEmitter,
): Promise<void> {
  const masterAddress = process.env.MASTER_ADDRESS;
  const masterPrivateKey = process.env.MASTER_PRIVATE_KEY;
  if (!masterAddress || !masterPrivateKey) return;
  if (!feeTokenAddress) return;

  try {
    // Query fee amount from world config
    const sqlUrl = `${toriiBaseUrl}/sql?query=${encodeURIComponent(
      'SELECT "blitz_registration_config.fee_amount" AS fee_amount FROM "s1_eternum-WorldConfig" LIMIT 1;',
    )}`;
    const resp = await fetch(sqlUrl);
    if (!resp.ok) return;
    const rows = (await resp.json()) as Record<string, unknown>[];
    const rawFee = rows[0]?.fee_amount;
    if (!rawFee) return;
    const feeAmount = BigInt(String(rawFee));
    if (feeAmount === 0n) return;

    // Check agent's current fee token balance via RPC
    const rpcProvider = new RpcProvider({ nodeUrl: rpcUrl });
    const balanceResult = await rpcProvider.callContract({
      contractAddress: feeTokenAddress,
      entrypoint: "balance_of",
      calldata: [agentAddress],
    });
    const balance = BigInt(balanceResult[0] ?? "0");

    if (balance >= feeAmount) return; // Already funded

    // Transfer shortfall from master account
    const shortfall = feeAmount - balance;
    const masterAccount = new Account({ provider: rpcProvider, address: masterAddress, signer: masterPrivateKey });
    const amount = uint256.bnToUint256(shortfall);
    await masterAccount.execute({
      contractAddress: feeTokenAddress,
      entrypoint: "transfer",
      calldata: CallData.compile([agentAddress, amount.low, amount.high]),
    });

    emitter.emit({
      type: "startup",
      message: `Auto top-up: transferred ${(Number(shortfall) / 1e18).toFixed(2)} fee tokens from master account`,
    });

    // Brief wait for indexing
    await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    emitter.emit({
      type: "error",
      message: `Auto top-up failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

export async function mainHeadless(options: CliOptions): Promise<void> {
  let config = loadConfig();

  // Scope data dir per-world so multiple agents don't share state
  if (options.world) {
    config.dataDir = path.join(config.dataDir, options.world);
  }

  // Propagate world-scoped dataDir so debug log helpers pick it up
  process.env.AGENT_DATA_DIR = config.dataDir;

  // Ensure data dir is seeded (soul.md, HEARTBEAT.md, tasks/) even if `init` was never run
  seedDataDir(config.dataDir);

  const emitter = new JsonEmitter({
    verbosity: options.verbosity,
    write: (line) => process.stdout.write(line + "\n"),
  });

  // Read artifacts from session directory
  const worldDir = path.join(config.sessionBasePath, options.world!);
  const artifacts = readArtifacts(worldDir);

  // Override config from artifacts
  config.rpcUrl = artifacts.profile.rpcUrl ?? config.rpcUrl;
  config.toriiUrl = `${artifacts.profile.toriiBaseUrl}/sql`;
  config.worldAddress = artifacts.profile.worldAddress;
  config.chainId = deriveChainIdFromRpcUrl(config.rpcUrl) ?? config.chainId;
  config.chain = artifacts.profile.chain;

  // Create account (session or privatekey)
  let account: AccountInterface;
  let session: ControllerSession | null = null;

  if (options.auth === "privatekey") {
    const privateKey = process.env.PRIVATE_KEY ?? "";
    const accountAddress = process.env.ACCOUNT_ADDRESS ?? "";
    account = createPrivateKeyAccount(config.rpcUrl, privateKey, accountAddress);
  } else {
    const sessionBasePath = path.join(config.sessionBasePath, options.world!);
    session = new ControllerSession({
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      gameName: config.gameName,
      basePath: sessionBasePath,
      manifest: artifacts.manifest,
      worldProfile: artifacts.profile,
    });

    // Try probe() first (uses SessionAccount WASM). If it crashes (starknet v8
    // compatibility issue), fall back to constructing a raw Account from the
    // stored session keypair — loses session/paymaster features but works.
    try {
      const probed = await session.probe();
      if (probed) {
        account = probed;
      } else {
        // No cached session — need full connect (browser auth)
        account = await session.connect();
      }
    } catch (probeError) {
      // SessionAccount WASM crashed — fall back to raw account from session.json
      emitter.emit({ type: "error", message: `probe() failed: ${probeError instanceof Error ? probeError.stack ?? probeError.message : String(probeError)}` });
      const sessionFilePath = path.join(sessionBasePath, "session.json");
      try {
        const raw = readFileSync(sessionFilePath, "utf-8");
        const data = JSON.parse(raw);
        const signer = JSON.parse(data.signer);
        const sess = JSON.parse(data.session);
        account = createPrivateKeyAccount(config.rpcUrl, signer.privKey, sess.address);
        emitter.emit({ type: "session", status: "active", message: "Using raw session keypair (WASM fallback)" });
      } catch (fallbackErr) {
        throw new Error(`Session probe failed and fallback failed: ${fallbackErr}`);
      }
    }
  }

  // Auto top-up fee tokens on non-mainnet chains (mirrors game client logic)
  if (artifacts.profile.chain !== "mainnet") {
    await autoTopUpFeeTokens(
      config.rpcUrl,
      artifacts.profile.toriiBaseUrl,
      account.address,
      artifacts.profile.feeTokenAddress,
      emitter,
    );
  }

  // Create Eternum client
  const client = await EternumClient.create({
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    worldAddress: config.worldAddress,
    manifest: artifacts.manifest as any,
  });
  client.connect(account as any);

  const tokenConfig = artifacts.profile ? {
    feeToken: artifacts.profile.feeTokenAddress,
    entryToken: artifacts.profile.entryTokenAddress,
    worldAddress: config.worldAddress,
  } : undefined;

  // Find the blitz contract address from manifest for registration flow
  const blitzContract = (artifacts.manifest as any).contracts?.find(
    (c: any) => typeof c.tag === "string" && c.tag.includes("blitz_realm_systems"),
  );
  const blitzAddress: string = blitzContract?.address ?? "";
  const adapter = new EternumGameAdapter(client, account as any, account.address, artifacts.manifest as any, config.gameName, tokenConfig);
  const mutableAdapter = new MutableGameAdapter(adapter);

  emitter.emit({
    type: "startup",
    world: options.world,
    chain: artifacts.profile.chain,
    address: account.address,
  });

  // Create game agent
  const model = (getModel as Function)(config.modelProvider, config.modelId);
  let isFirstTick = true;
  const formatTickPromptWithHandbooks = (state: EternumWorldState): string => {
    const base = formatEternumTickPrompt(state);
    const needsRegistration = state.player.structures === 0 && state.player.armies === 0;

    if (needsRegistration) {
      // Build registration instructions with known token addresses
      const feeToken = tokenConfig?.feeToken ?? "the fee token";
      const entryToken = tokenConfig?.entryToken ?? "the entry token";
      const spender = blitzAddress || "the blitz contract";
      return `${base}\n\nCRITICAL: You have 0 structures and 0 armies. You are NOT registered in the game yet. You MUST register RIGHT NOW before doing anything else:\n\nStep 1: approve_token (token_address: "${feeToken}", spender: "${spender}", amount: "10000000000000000000")\nStep 2: obtain_entry_token (no params) — mints an entry token NFT to you\nStep 3: Find your minted token_id. Use inspect_sql to query your entry token balance.\nStep 4: lock_entry_token (token_id: <from step 3>, lock_id: 69)\nStep 5: register (name: your player name, entry_token_id: <from step 3>, cosmetic_token_ids: [])\nStep 6: settle_blitz_realm (settlement_count: 1) — bundles VRF + assign positions + settle atomically\n\nThe lock_id is always 69 (constant). If obtain_entry_token fails with "transfer amount exceeds balance", your account has insufficient fee tokens — report the error and stop.\n\nDo NOT study handbooks, do NOT list actions, do NOT write learnings. Just register.`;
    }

    if (isFirstTick) {
      isFirstTick = false;
      const handbooks = loadReferenceHandbooks(config.dataDir);
      if (handbooks) {
        return `${handbooks}\n\n---\n\n${base}\n\nIMPORTANT: This is your first tick. Study the reference handbooks above carefully before taking any actions. Write key insights to tasks/learnings.md so you retain them.`;
      }
    }
    return base;
  };

  let game: ReturnType<typeof createGameAgent> | null = null;

  const runtimeConfigManager = createRuntimeConfigManager({
    getConfig: () => config,
    setConfig: (c) => { config = c; },
    getAgent: () => game,
    onMessage: (msg) => emitter.emit({ type: "config", message: msg }),
  });

  game = createGameAgent({
    adapter: mutableAdapter,
    dataDir: config.dataDir,
    model,
    tickIntervalMs: config.tickIntervalMs,
    runtimeConfigManager,
    extraTools: createInspectTools(client),
    actionDefs: getActionDefinitions(),
    formatTickPrompt: formatTickPromptWithHandbooks,
    onTickError: (err) => {
      emitter.emit({ type: "error", message: `Tick error: ${err.message}` });
    },
  });

  const { agent, ticker, dispose: disposeAgent } = game!;

  // Subscribe to agent events and map to emitter
  agent.subscribe((event) => {
    switch (event.type) {
      case "agent_start":
        break;
      case "agent_end":
        break;
      case "tool_execution_start":
        emitter.emit({
          type: "action",
          tick: ticker.tickCount,
          action: event.toolName,
          params: event.args,
          status: "started",
        });
        break;
      case "tool_execution_end":
        emitter.emit({
          type: "action",
          tick: ticker.tickCount,
          action: event.toolName,
          status: event.isError ? "fail" : "ok",
        });
        break;
      case "message_end":
        if (event.message.role === "assistant") {
          const content = event.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text.trim()) {
                emitter.emit({
                  type: "decision",
                  tick: ticker.tickCount,
                  reasoning: block.text.slice(0, 500),
                  actions: [],
                });
              }
            }
          }
        }
        break;
    }
  });

  // Heartbeat
  const heartbeat = createHeartbeatLoop({
    getHeartbeatPath: () => path.join(config.dataDir, "HEARTBEAT.md"),
    onRun: async (job: HeartbeatJob) => {
      emitter.emit({ type: "heartbeat", job: job.id, mode: job.mode });
      const modeGuidance =
        job.mode === "observe"
          ? "Observe-only heartbeat: do not execute on-chain actions. You may read and update markdown/task files."
          : "Action-enabled heartbeat: you may execute actions if justified.";
      const heartbeatPrompt = [
        `## Heartbeat Job: ${job.id}`,
        `Schedule: ${job.schedule}`,
        `Mode: ${job.mode}`,
        modeGuidance,
        "Follow the job instructions below:",
        job.prompt,
      ].join("\n\n");
      await game!.enqueuePrompt(heartbeatPrompt);
    },
    onError: (error) => {
      emitter.emit({ type: "error", message: `Heartbeat error: ${error.message}` });
    },
  });

  // Shutdown gate
  const gate = createShutdownGate();

  const shutdown = async () => {
    emitter.emit({ type: "shutdown", reason: "requested" });
    heartbeat.stop();
    ticker.stop();
    await disposeAgent();
    client.disconnect();
    if (apiClose) await apiClose();
    if (stdinClose) stdinClose();
    gate.shutdown();
  };

  // HTTP API
  let apiClose: (() => Promise<void>) | null = null;
  if (options.apiPort) {
    const { close } = createApiServer(
      {
        enqueuePrompt: async (content) => {
          emitter.emit({ type: "prompt", source: "http", content });
          await game!.enqueuePrompt(content);
        },
        getStatus: () => ({
          tick: ticker.tickCount,
          session: "active",
          loopEnabled: config.loopEnabled,
          world: options.world,
        }),
        getState: () => ({}),
        shutdown,
        applyConfig: async (changes) => runtimeConfigManager.applyChanges(changes),
        emitter,
      },
      options.apiPort,
      options.apiHost ?? "127.0.0.1",
    );
    apiClose = close;
    emitter.emit({
      type: "startup",
      message: `HTTP API listening on ${options.apiHost ?? "127.0.0.1"}:${options.apiPort}`,
    });
  }

  // Stdin reader
  let stdinClose: (() => void) | null = null;
  if (options.stdin || !process.stdin.isTTY) {
    stdinClose = startStdinReader({
      enqueuePrompt: async (content) => {
        emitter.emit({ type: "prompt", source: "stdin", content });
        await game!.enqueuePrompt(content);
      },
      applyConfig: async (changes) => runtimeConfigManager.applyChanges(changes),
      shutdown,
    });
  }

  // Start loops
  if (config.loopEnabled) {
    ticker.start();
  }
  heartbeat.start();

  // Signal handlers
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return gate.promise;
}
