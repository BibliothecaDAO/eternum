import { PHASE_END_ERROR } from "../../apps/launch-service/src/calendar";
import { resolveBlitzSeason } from "./blitz-season";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CallData, RpcProvider, uint256 } from "starknet";
import { decodeLedgerPreset } from "../../packages/value-ledger/src/codecs";
import { readConfirmedSnapshot, optionalRow } from "../../apps/value-relay/src/shard-snapshot";
import { buildFrontierFundingCalls } from "../../contracts/l2/ledger/scripts/commands/deployment/frontier.js";
import { readFrontierGame } from "../../contracts/l2/ledger/scripts/commands/deployment/fund-frontier";
import { readFrontierFunding, assertFrontierPreset } from "../../packages/value-ledger/src/frontier-funding";
import { isContractRevert, send, balance } from "./chain";
import { nativeDocument, boxRead, releaseDirectory, deployShard } from "./box";
import { workersReady, deployWorkers, clientReady, deployClient } from "./publish";
import { command, shell } from "./process";
import { seconds, PublicError } from "./dates";
import { root, WEI } from "./settings";
import { signer, type Deployment } from "./main";
import type { Step } from "./run";

interface ReleaseInputs {
  chain_id: string;
  public_rpc_url: string;
  public_herald_url: string;
}
function releaseInputs(context: Deployment): ReleaseInputs | undefined {
  const path = join(root, "deploy/release", `${context.target.release}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}
async function service<T>(context: Deployment, path: string, method = "GET", body?: unknown): Promise<T> {
  if (!context.apply && method !== "GET") throw new Error("Dry run cannot write a service");
  const response = await fetch(`${context.target.origin}${path}`, {
    method,
    redirect: "error",
    headers: {
      "User-Agent": "realms-deployment/1",
      "Content-Type": "application/json",
      ...(context.secrets ? { Authorization: `Bearer ${context.secrets.operator}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error("Service request failed");
  return response.json() as Promise<T>;
}
async function jsonGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { redirect: "error", headers: { "User-Agent": "realms-deployment/1" } });
  if (!response.ok) throw new Error("Public deployment read failed");
  return response.json() as Promise<T>;
}
async function games(context: Deployment) {
  const release = releaseInputs(context)!;
  return jsonGet<{ games: { game_id: number; mode: string; clock: { start_main_at: number } }[] }>(
    `${release.public_herald_url}/games`,
  );
}
async function frontierGame(context: Deployment) {
  const calendar = await service<{ phases: { phase: string; startsAt: string }[] }>(context, "/api/factory/calendar");
  const phase = calendar.phases.find((phase) => phase.phase === "frontier");
  if (!phase) return undefined;
  const expected = Date.parse(phase.startsAt) / 1000;
  if (expected !== seconds(context.inputs!.frontierStart))
    throw new Error("Frontier calendar start differs from entered dates");
  const candidates = (await games(context)).games.filter(
    (game) => game.mode === "frontier" && game.clock.start_main_at === expected,
  );
  if (candidates.length > 1) throw new Error("Multiple Frontier games match the calendar");
  return candidates[0]?.game_id;
}
async function shardConnection(context: Deployment) {
  const release = releaseInputs(context)!;
  const manifest = await nativeDocument(context.target);
  if (!manifest?.shard?.chainId || !manifest.world?.address) throw new Error("Box native-world.json is unavailable");
  const publicManifest = await jsonGet<{ chainId: string }>(`${release.public_herald_url}/manifest`);
  if (BigInt(manifest.shard.chainId) !== BigInt(publicManifest.chainId))
    throw new Error("Herald and box name different chains");
  return { rpcUrl: release.public_rpc_url, chainId: manifest.shard.chainId, gamesAddress: manifest.world.address };
}
async function funding(context: Deployment) {
  const gameId = await frontierGame(context);
  if (!gameId) return undefined;
  const shard = await shardConnection(context);
  const native = await readFrontierGame(
    new RpcProvider({ nodeUrl: shard.rpcUrl }),
    shard,
    releaseInputs(context)!.public_herald_url,
    gameId,
  );
  const preset = decodeLedgerPreset(
    await context.provider!.callContract(
      {
        contractAddress: context.assets!.ledger,
        entrypoint: "get_preset",
        calldata: [String(context.target.frontierPreset)],
      },
      "latest",
    ),
  );
  assertFrontierPreset(preset, native);
  const [token] = await context.provider!.callContract(
    { contractAddress: context.assets!.ledger, entrypoint: "lords", calldata: [] },
    "latest",
  );
  if (!token || BigInt(token) !== BigInt(context.assets!.lords))
    throw new Error("Ledger token differs from address book");
  try {
    const pool = await readFrontierFunding(
      context.provider!,
      context.assets!.ledger,
      { chainId: shard.chainId, gameId },
      native,
    );
    if (BigInt(pool.pool) !== BigInt(context.inputs!.amount) * WEI)
      throw new Error("Existing Frontier deposit differs; never add a second deposit");
    return { gameId, shard, native, funded: true };
  } catch (error) {
    if (isContractRevert(error, "Ledger: unknown Frontier season")) return { gameId, shard, native, funded: false };
    throw error;
  }
}
async function requireBlitzSeason(context: Deployment) {
  const season = await resolveBlitzSeason(
    context.provider!,
    context.assets!.ledger,
    seconds(context.inputs!.blitzStart),
    seconds(context.inputs!.blitzEnd),
  );
  if (!season.present) throw new PublicError("Blitz ledger season is not open; complete Ledger setup first");
}
async function currentCalendar(context: Deployment) {
  const calendar = await service<{ phases: { phase: string; startsAt: string; endsAt: string }[] }>(
    context,
    "/api/factory/calendar",
  );
  const now = Date.now();
  const phases = calendar.phases.filter((phase) => Date.parse(phase.endsAt) > now);
  for (const phase of phases) {
    const start = phase.phase === "frontier" ? context.inputs!.frontierStart : context.inputs!.blitzStart;
    const end = phase.phase === "frontier" ? context.inputs!.frontierEnd : context.inputs!.blitzEnd;
    if (Date.parse(phase.startsAt) !== Date.parse(start) || Date.parse(phase.endsAt) !== Date.parse(end))
      throw new PublicError("Existing calendar dates differ from inputs.json; no phase was changed");
  }
  return phases;
}
export function deliverySteps(context: Deployment): Step[] {
  const wait = (detail: string) => ({ done: false, waiting: detail, detail });
  return [
    {
      name: "Public address book commit",
      payer: "none",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.assets) return wait("Contracts not yet published");
        const book = `contracts/common/addresses/${context.target.book}`;
        const diff = await command({ argv: ["git", "status", "--porcelain", "--", book] });
        return {
          done: !diff.trim(),
          detail: "commit and push only the public address book; no private state enters git",
        };
      },
      apply: async () => {
        const book = `contracts/common/addresses/${context.target.book}`;
        const staged = (await command({ argv: ["git", "diff", "--cached", "--name-only"] }))
          .trim()
          .split("\n")
          .filter(Boolean);
        if (staged.some((path) => path !== book))
          throw new Error("Unrelated staged changes must be handled before publishing the address book");
        const dirty = (await command({ argv: ["git", "status", "--porcelain", "--", book] })).trim();
        const branch = (await command({ argv: ["git", "branch", "--show-current"] })).trim();
        if (!branch || branch === "next")
          throw new PublicError("Create a branch for the public address book, push it to origin, then rerun.");
        if (dirty) {
          await command({ argv: ["git", "add", "--", book] });
          await command({
            argv: ["git", "commit", "-m", `Publish ${context.environment} value contract addresses`, "--", book],
          });
        }
        await command({ argv: ["git", "push", "origin", `HEAD:${branch}`] });
        throw new PublicError(
          "Public address book pushed. Rerun from this clean commit; production requires its merge to next and green push validation.",
        );
      },
    },
    {
      name: "Workers",
      payer: "none",
      cost: "Cloudflare plan charges; shard signing free",
      inspect: async () => {
        const revision = context.revision;
        if (!revision || !context.platform) return wait("Checkout revision and Cloudflare credentials needed");
        return {
          done: await workersReady(context.platform, revision),
          detail: "migrate D1 and deploy all six Workers at the release revision; preserve existing secrets",
        };
      },
      apply: async () => {
        const revision = context.revision!;
        await deployWorkers(context.platform!, revision);
      },
    },
    {
      name: "Shard deployment and self-check",
      payer: "shard launcher",
      cost: "0 STRK",
      inspect: async () => {
        const release = releaseInputs(context);
        const revision = context.revision;
        if (!revision || !release) return wait("Committed shard configuration needed");
        const document = await nativeDocument(context.target);
        if (!document)
          return {
            done: false,
            detail:
              "drain and stop the old shard, preserve its data, then deploy the reviewed release and run its full self-check",
          };
        const expectedChain = BigInt(`0x${Buffer.from(release.chain_id).toString("hex")}`);
        if (BigInt(document.shard.chainId) !== expectedChain)
          throw new Error("New shard directory contains a different chain; data was not overwritten");
        const proof = await boxRead(
          context.target,
          `if [ -f ${shell(`${releaseDirectory(context.target)}/first-deployment-check.json`)} ]; then cat ${shell(`${releaseDirectory(context.target)}/first-deployment-check.json`)}; else echo null; fi`,
        );
        const saved = JSON.parse(proof);
        if (!saved || saved.revision !== revision)
          return { done: false, detail: "run the deployment self-check against the current release" };
        await jsonGet(`${release.public_herald_url}/health`);
        const directory = await service<{ shards: { url: string; status: string }[] }>(context, "/api/directory");
        return {
          done: directory.shards.some((shard) => shard.url === release.public_herald_url && shard.status === "active"),
          detail: "native-world identity, live Herald and active directory checked",
        };
      },
      apply: async () => {
        const revision = context.revision!;
        await deployShard(context.target, revision);
      },
    },
    {
      name: "Client",
      payer: "none",
      cost: "Cloudflare build charges; 0 STRK",
      inspect: async () => {
        const revision = context.revision;
        return revision
          ? {
              done: await clientReady(context.platform!, revision),
              detail:
                "build locally, verify chain/RPC and assets, publish Pages with wrangler, then verify live modules/routes",
            }
          : wait("Release needed");
      },
      apply: async () => {
        await deployClient(context.platform!, context.revision!);
      },
    },
    {
      name: "Season calendar",
      payer: "operator token",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.assets) return wait("Deployed services needed");
        const phases = await currentCalendar(context);
        await requireBlitzSeason(context);
        return {
          done: ["frontier", "blitz"].every((name) => phases.some((phase) => phase.phase === name)),
          detail: "set only missing phases; Frontier starts on a tick and ends at the explicit entered date",
        };
      },
      apply: async () => {
        const phases = await currentCalendar(context);
        await requireBlitzSeason(context);
        context.output(
          `Setting calendar: Frontier ${context.inputs!.frontierStart} to ${context.inputs!.frontierEnd}, pool ${context.inputs!.amount}; Blitz ${context.inputs!.blitzStart} to ${context.inputs!.blitzEnd}.`,
        );
        for (const phase of ["frontier", "blitz"]) {
          if (phases.some((existing) => existing.phase === phase)) continue;
          const begins = seconds(phase === "frontier" ? context.inputs!.frontierStart : context.inputs!.blitzStart);
          const ends = seconds(phase === "frontier" ? context.inputs!.frontierEnd : context.inputs!.blitzEnd);
          if (!(ends > Date.now() / 1000)) throw new PublicError(PHASE_END_ERROR);
          await service(context, `/api/factory/calendar/${phase}`, "PUT", {
            startsAt: new Date(begins * 1000).toISOString(),
            endsAt: new Date(ends * 1000).toISOString(),
          });
        }
      },
    },
    {
      name: "Frontier deposit",
      payer: context.target.coldAdmin ? "cold admin" : "deployer",
      cost: "deposit amount plus fee (dev first-deployment reserve includes it)",
      inspect: async () => {
        if (!context.assets || !context.revision) return wait("Deployed shard and ledger needed");
        const state = await funding(context);
        if (!state)
          return {
            done: false,
            detail:
              "wait for the confirmed Frontier game and fund it immediately in this run; no chest exists before funding",
          };
        return {
          done: state.funded,
          detail: `fund exactly confirmed game ${state.gameId}; native-world.json comes from the box, not Herald /manifest`,
        };
      },
      apply: async () => {
        const state = await waitFor(
          context,
          () => funding(context),
          "Waiting for the confirmed Frontier game; funding follows immediately.",
        );
        const account = signer(context);
        const pool = BigInt(context.inputs!.amount) * WEI;
        if (context.target.freshAssets && (await balance(account, context.assets!.lords, account.address)) < pool)
          await send(
            account,
            [
              {
                contractAddress: context.assets!.lords,
                entrypoint: "mint",
                calldata: CallData.compile([account.address, uint256.bnToUint256(pool)]),
              },
            ],
            context.store,
            `test-tokens-${state.gameId}`,
            context.output,
          );
        const calls = buildFrontierFundingCalls(context.assets!.ledger, context.assets!.lords, {
          shard: state.shard.chainId,
          frontierSeasonId: state.gameId,
          presetId: context.target.frontierPreset,
          start: state.native.start,
          end: state.native.end,
          seed: state.native.seed,
          pool,
        });
        if (context.target.coldAdmin) {
          context.store.write("cold-funding.json", { account: context.inputs!.admin, calls });
          context.output(
            "Cold admin: review and execute cold-funding.json with your wallet holding the LORDS deposit, then rerun.",
          );
          return;
        }
        if ((await balance(account, context.assets!.lords, account.address)) < pool)
          throw new Error("Deployer token balance is below the deposit");
        await send(account, calls, context.store, `frontier-${state.gameId}`, context.output);
      },
    },
    {
      name: "Published pool and automatic Blitz slot",
      payer: "relay",
      cost: "relay reserve about 30 STRK for the measured day",
      inspect: async () => {
        if (!context.assets || !context.revision) return wait("Released services and funded game needed");
        const state = await funding(context);
        if (!state?.funded) return wait("Fund the confirmed game first");
        return {
          done: await poolPublished(context),
          detail: "wait for confirmed published pool, automatic slot and healthy relay/monitor",
        };
      },
      apply: async () => {
        await waitFor(context, () => poolPublished(context), "Waiting for published deposit and automatic Blitz slot.");
      },
    },
  ];
}

async function poolPublished(context: Deployment) {
  const state = await funding(context);
  if (!state?.funded) return false;
  const snapshot = await readConfirmedSnapshot(state.shard, releaseInputs(context)!.public_herald_url, state.gameId, [
    "LordsBudget",
  ]);
  const budget = optionalRow(snapshot, "LordsBudget");
  if (!budget || BigInt(String(budget.pool)) === 0n) return false;
  if (BigInt(String(budget.pool)) !== BigInt(context.inputs!.amount))
    throw new Error("Published pool differs from the deposit");
  const slots = await service<{ slots: unknown[] }>(context, "/api/slots");
  if (!slots.slots.length) return false;
  await service(context, "/api/value/health");
  await service(context, "/api/operator/monitor/health");
  return true;
}
async function waitFor<T>(
  context: Deployment,
  read: () => Promise<T | undefined | false>,
  message: string,
): Promise<T> {
  if (!context.apply) throw new Error("Dry run cannot wait for a future write");
  for (;;) {
    const value = await read();
    if (value) return value;
    context.output(message);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
