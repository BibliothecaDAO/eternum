import { PHASE_END_ERROR, type FrontierSeasonPhase, type SeasonPhase } from "../../apps/launch-service/src/calendar";
import { CallData, RpcProvider, uint256 } from "starknet";
import { decodeLedgerPreset } from "../../packages/value-ledger/src/codecs";
import { readConfirmedSnapshot, optionalRow } from "../../apps/value-relay/src/shard-snapshot";
import { firstReleaseOf } from "../../apps/value-relay/src/shard-rpc";
import { buildFrontierFundingCalls } from "../../contracts/l2/ledger/scripts/commands/deployment/frontier.js";
import { readFrontierGame } from "../../contracts/l2/ledger/scripts/commands/deployment/fund-frontier";
import { readFrontierFunding, assertFrontierPreset } from "../../packages/value-ledger/src/frontier-funding";
import { isTestLords } from "../../packages/chain/src/value-plane";
import { presetIdForEnvironment } from "../../config/deployer/clean/constants";
import { send, balance } from "./chain";
import { nativeDocument } from "./box";
import { seconds } from "./dates";
import { PublicError } from "./errors";
import { ledgerAdmin, shardInputs, WEI } from "./settings";
import { signer, type Deployment } from "./main";
import type { Step } from "./run";

export type Season = Omit<Deployment, "revision">;

async function service<T>(context: Season, path: string, method = "GET", body?: unknown): Promise<T> {
  if (!context.apply && method !== "GET") throw new PublicError("Dry run cannot write a service");
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
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const code =
      typeof body?.error === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(body.error)
        ? body.error
        : "invalid_service_error";
    throw new PublicError(`Service ${path}: HTTP ${response.status}; code ${code}.`, response.status, code);
  }
  return response.json() as Promise<T>;
}
async function jsonGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { redirect: "error", headers: { "User-Agent": "realms-deployment/1" } });
  if (!response.ok)
    throw new PublicError(`Public deployment read: HTTP ${response.status}.`, response.status, "public_read_refused");
  return response.json() as Promise<T>;
}
async function games(context: Season) {
  const release = shardInputs(context.target);
  return jsonGet<{ games: { game_id: number; mode: string; clock: { start_main_at: number } }[] }>(
    `${release.public_herald_url}/games`,
  );
}
async function frontierGame(context: Season) {
  const calendar = await service<{ phases: SeasonPhase[] }>(context, "/api/factory/calendar");
  const phase = calendar.phases.find((phase) => phase.phase === "frontier");
  if (!phase) return undefined;
  const expected = Date.parse(phase.startsAt) / 1000;
  const candidates = (await games(context)).games.filter(
    (game) => game.mode === "frontier" && game.clock.start_main_at === expected,
  );
  if (candidates.length > 1) throw new PublicError("Multiple Frontier games match the calendar");
  return candidates[0] ? { gameId: candidates[0].game_id, phase } : undefined;
}
async function shardConnection(context: Season) {
  const release = shardInputs(context.target);
  const manifest = await nativeDocument(context.target);
  if (!manifest?.shard?.chainId || !manifest.world?.address)
    throw new PublicError("Box native-world.json is unavailable");
  const publicManifest = await jsonGet<{ chainId: string; releases: Record<string, unknown> }>(
    `${release.public_herald_url}/manifest`,
  );
  if (BigInt(manifest.shard.chainId) !== BigInt(publicManifest.chainId))
    throw new PublicError("Herald and box name different chains");
  return {
    rpcUrl: release.public_rpc_url,
    chainId: manifest.shard.chainId,
    gamesAddress: manifest.world.address,
    firstRelease: firstReleaseOf(publicManifest.releases),
  };
}
function assertCalendarGame(phase: FrontierSeasonPhase, native: { start: number; end: number }) {
  if (native.start !== Date.parse(phase.startsAt) / 1000 || native.end !== Date.parse(phase.endsAt) / 1000)
    throw new PublicError("Confirmed Frontier game differs from calendar dates");
}
async function funding(context: Season) {
  const selected = await frontierGame(context);
  if (!selected) return undefined;
  const { gameId, phase } = selected;
  const shard = await shardConnection(context);
  const native = await readFrontierGame(
    new RpcProvider({ nodeUrl: shard.rpcUrl }),
    shard,
    shardInputs(context.target).public_herald_url,
    gameId,
  );
  assertCalendarGame(phase, native);
  const block = await context.provider!.getBlockNumber();
  const preset = decodeLedgerPreset(
    await context.provider!.callContract(
      {
        contractAddress: context.assets!.ledger,
        entrypoint: "get_preset",
        calldata: [String(presetIdForEnvironment("madara.frontier"))],
      },
      block,
    ),
  );
  assertFrontierPreset(preset, native);
  const [token] = await context.provider!.callContract(
    { contractAddress: context.assets!.ledger, entrypoint: "lords", calldata: [] },
    block,
  );
  if (!token || BigInt(token) !== BigInt(context.assets!.lords))
    throw new PublicError("Ledger token differs from address book");
  try {
    const pool = await readFrontierFunding(
      context.provider!,
      context.assets!.ledger,
      { chainId: shard.chainId, gameId },
      native,
      block,
    );
    const deposit = BigInt(context.inputs!.amount) * WEI;
    const prize = ((deposit * BigInt(10_000 - native.chestPoolBps)) / 10_000n / WEI) * WEI;
    const chest = deposit - prize;
    if (BigInt(pool.pool) < chest || BigInt(pool.prizePool) !== deposit - chest)
      throw new PublicError("Existing Frontier deposit differs; never add a second deposit");
    return { gameId, shard, native, block, funded: true, pool };
  } catch (error) {
    if (error instanceof Error && error.message === "frontier_funding_missing")
      return { gameId, shard, native, block, funded: false };
    throw error;
  }
}
async function currentCalendar(context: Season) {
  const calendar = await service<{ phases: SeasonPhase[] }>(context, "/api/factory/calendar");
  const now = Date.now();
  const phases = calendar.phases.filter((phase) => Date.parse(phase.endsAt) > now);
  return phases;
}
export function seasonSteps(context: Season): Step[] {
  const wait = (detail: string) => ({ done: false, waiting: detail, detail });
  return [
    {
      name: "Season calendar",
      payer: "operator token",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.assets) return wait("Deployed services needed");
        const phases = await currentCalendar(context);
        return {
          done: phases.some((phase) => phase.phase === "frontier"),
          detail: phases.length
            ? phases.map((phase) => `${phase.phase} ${phase.startsAt} to ${phase.endsAt}`).join("; ")
            : "set missing phases from saved dates",
        };
      },
      apply: async () => {
        const phases = await currentCalendar(context);
        if (phases.some((existing) => existing.phase === "frontier")) return;
        const begins = seconds(context.inputs!.frontierStart);
        const ends = seconds(context.inputs!.frontierEnd);
        if (!(ends > Date.now() / 1000)) throw new PublicError(PHASE_END_ERROR);
        context.output(
          `Setting frontier calendar: ${new Date(begins * 1000).toISOString()} to ${new Date(ends * 1000).toISOString()}.`,
        );
        await service(context, "/api/factory/calendar/frontier", "PUT", {
          startsAt: new Date(begins * 1000).toISOString(),
          endsAt: new Date(ends * 1000).toISOString(),
        });
      },
    },
    {
      name: "Frontier deposit",
      payer: context.target.coldAdmin ? "cold admin" : "deployer",
      cost: "deposit amount plus fee (dev first-deployment reserve includes it)",
      inspect: async () => {
        if (!context.assets) return wait("Deployed shard and ledger needed");
        const state = await funding(context);
        if (!state)
          return {
            done: false,
            detail:
              "wait for the confirmed Frontier game and fund it immediately in this run; no chest exists before funding",
          };
        return {
          done: state.funded,
          detail: `fund ${context.inputs!.amount} LORDS in confirmed game ${state.gameId}; chain and world read from the box`,
        };
      },
      apply: async () => {
        const state = await waitFor(
          context,
          () => funding(context),
          "Waiting for the confirmed Frontier game; funding follows immediately.",
        );
        if (state.funded) return;
        const account = signer(context);
        const pool = BigInt(context.inputs!.amount) * WEI;
        const lords = context.assets!.lords;
        const payer = ledgerAdmin(context.target, context.inputs!, account.address);
        const mint = await shortfallMint(account, lords, payer, pool, state.block);
        const calls = buildFrontierFundingCalls(context.assets!.ledger, lords, {
          shard: state.shard.chainId,
          frontierSeasonId: state.gameId,
          presetId: presetIdForEnvironment("madara.frontier"),
          start: state.native.start,
          end: state.native.end,
          seed: state.native.seed,
          pool,
        });
        if (context.target.coldAdmin) {
          context.store.write("cold-funding.json", { account: payer, calls: [...mint, ...calls] });
          context.output("Cold admin: review and execute cold-funding.json with your wallet, then rerun.");
          return;
        }
        if (mint.length)
          await send(
            account,
            mint,
            context.store,
            `test-tokens-${state.shard.chainId}-${state.gameId}`,
            context.output,
            state.block,
          );
        const deposit = await funding(context);
        if (!deposit || deposit.gameId !== state.gameId || deposit.shard.chainId !== state.shard.chainId)
          throw new PublicError("Frontier game changed before the deposit");
        if (deposit.funded) return;
        if ((await balance(account, context.assets!.lords, account.address, deposit.block)) < pool)
          throw new PublicError("Deployer token balance is below the deposit");
        await send(
          account,
          calls,
          context.store,
          `frontier-${state.shard.chainId}-${state.gameId}`,
          context.output,
          deposit.block,
        );
      },
    },
    {
      name: "Published pool",
      payer: "relay",
      cost: "relay mainnet fees use its 30 STRK initial reserve; no daily cap",
      inspect: async () => {
        if (!context.assets) return wait("Released services and funded game needed");
        const state = await funding(context);
        if (!state?.funded) return wait("Fund the confirmed game first");
        return {
          done: await poolPublished(context),
          detail: "wait for confirmed published pool and healthy relay/monitor",
        };
      },
      apply: async () => {
        await waitFor(context, () => poolPublished(context), "Waiting for the published deposit.");
      },
    },
  ];
}

/**
 * What the payer must mint before its deposit: a test token's shortfall, through its public mint. LORDS has no mint, so
 * a payer short of LORDS is refused before any call is prepared.
 */
async function shortfallMint(provider: RpcProvider, lords: string, payer: string, pool: bigint, block: number) {
  if ((await balance(provider, lords, payer, block)) >= pool) return [];
  if (!isTestLords(lords)) throw new PublicError("The payer holds less LORDS than the deposit; send it LORDS first");
  return [
    {
      contractAddress: lords,
      entrypoint: "mint",
      calldata: CallData.compile([payer, uint256.bnToUint256(pool)]),
    },
  ];
}

async function poolPublished(context: Season) {
  const state = await funding(context);
  if (!state?.funded) return false;
  const snapshot = await readConfirmedSnapshot(
    state.shard,
    shardInputs(context.target).public_herald_url,
    state.gameId,
    ["LordsBudget", "FrontierPrize"],
  );
  const budget = optionalRow(snapshot, "LordsBudget");
  if (!budget || BigInt(String(budget.pool)) === 0n) return false;
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (
    BigInt(String(budget.pool)) !== BigInt(state.pool!.pool) / WEI ||
    !prize ||
    BigInt(String(prize.pool)) !== BigInt(state.pool!.prizePool) / WEI
  )
    throw new PublicError("Published pool differs from the deposit");
  await service(context, "/api/value/health");
  await service(context, "/api/operator/monitor/health");
  return true;
}
async function waitFor<T>(context: Season, read: () => Promise<T | undefined | false>, message: string): Promise<T> {
  if (!context.apply) throw new PublicError("Dry run cannot wait for a future write");
  for (;;) {
    const value = await read();
    if (value) return value;
    context.output(message);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
