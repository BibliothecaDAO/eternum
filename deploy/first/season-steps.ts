import { PHASE_END_ERROR, type FrontierSeasonPhase, type SeasonPhase } from "../../apps/launch-service/src/calendar";
import { resolveBlitzSeason } from "./blitz-season";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CallData, RpcProvider, uint256 } from "starknet";
import { decodeLedgerPreset } from "../../packages/value-ledger/src/codecs";
import { readConfirmedSnapshot, optionalRow } from "../../apps/value-relay/src/shard-snapshot";
import { buildFrontierFundingCalls } from "../../contracts/l2/ledger/scripts/commands/deployment/frontier.js";
import { readFrontierGame } from "../../contracts/l2/ledger/scripts/commands/deployment/fund-frontier";
import { readFrontierFunding, assertFrontierPreset } from "../../packages/value-ledger/src/frontier-funding";
import { isTestLords } from "../../packages/chain/src/value-plane";
import { send, balance } from "./chain";
import { nativeDocument } from "./box";
import { seconds } from "./dates";
import { PublicError } from "./errors";
import { blitzPresetOf, root, WEI } from "./settings";
import { signer, type Deployment } from "./main";
import type { Step } from "./run";

export type Season = Omit<Deployment, "revision">;

interface ReleaseInputs {
  public_rpc_url: string;
  public_herald_url: string;
}
function releaseInputs(context: Season): ReleaseInputs | undefined {
  const path = join(root, "deploy/release", `${context.target.environment}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}
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
  const release = releaseInputs(context)!;
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
  const release = releaseInputs(context)!;
  const manifest = await nativeDocument(context.target);
  if (!manifest?.shard?.chainId || !manifest.world?.address)
    throw new PublicError("Box native-world.json is unavailable");
  const publicManifest = await jsonGet<{ chainId: string }>(`${release.public_herald_url}/manifest`);
  if (BigInt(manifest.shard.chainId) !== BigInt(publicManifest.chainId))
    throw new PublicError("Herald and box name different chains");
  return { rpcUrl: release.public_rpc_url, chainId: manifest.shard.chainId, gamesAddress: manifest.world.address };
}
function assertCalendarGame(phase: FrontierSeasonPhase, native: { presetId: number; start: number; end: number }) {
  if (
    native.presetId !== phase.presetId ||
    native.start !== Date.parse(phase.startsAt) / 1000 ||
    native.end !== Date.parse(phase.endsAt) / 1000
  )
    throw new PublicError("Confirmed Frontier game differs from calendar preset or dates");
}
async function funding(context: Season) {
  const selected = await frontierGame(context);
  if (!selected) return undefined;
  const { gameId, phase } = selected;
  const shard = await shardConnection(context);
  const native = await readFrontierGame(
    new RpcProvider({ nodeUrl: shard.rpcUrl }),
    shard,
    releaseInputs(context)!.public_herald_url,
    gameId,
  );
  assertCalendarGame(phase, native);
  const block = await context.provider!.getBlockNumber();
  const preset = decodeLedgerPreset(
    await context.provider!.callContract(
      {
        contractAddress: context.assets!.ledger,
        entrypoint: "get_preset",
        calldata: [String(native.presetId)],
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
/** A Blitz phase needs its ledger season open; a Frontier-only environment has neither. */
async function requireBlitzSeason(context: Season) {
  if (blitzPresetOf(context.target) === null) return;
  const season = await resolveBlitzSeason(
    context.provider!,
    context.assets!.ledger,
    seconds(context.inputs!.blitzStart!),
    seconds(context.inputs!.blitzEnd!),
  );
  if (!season.present) throw new PublicError("Blitz ledger season is not open; complete Ledger setup first");
}
/** The calendar phases this environment runs: Frontier, and Blitz where it has a Blitz preset. */
const seasonPhases = (context: Season) => ["frontier", ...(blitzPresetOf(context.target) === null ? [] : ["blitz"])];
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
        await requireBlitzSeason(context);
        return {
          done: seasonPhases(context).every((name) => phases.some((phase) => phase.phase === name)),
          detail: phases.length
            ? phases
                .map(
                  (phase) =>
                    `${phase.phase}${phase.phase === "frontier" ? ` preset ${phase.presetId}` : ""} ${phase.startsAt} to ${phase.endsAt}`,
                )
                .join("; ")
            : "set missing phases from saved dates",
        };
      },
      apply: async () => {
        const phases = await currentCalendar(context);
        await requireBlitzSeason(context);
        for (const phase of seasonPhases(context)) {
          if (phases.some((existing) => existing.phase === phase)) continue;
          const begins = seconds(phase === "frontier" ? context.inputs!.frontierStart : context.inputs!.blitzStart!);
          const ends = seconds(phase === "frontier" ? context.inputs!.frontierEnd : context.inputs!.blitzEnd!);
          if (!(ends > Date.now() / 1000)) throw new PublicError(PHASE_END_ERROR);
          context.output(
            `Setting ${phase}${phase === "frontier" ? ` preset ${context.inputs!.frontierPresetId}` : ""} calendar: ${new Date(begins * 1000).toISOString()} to ${new Date(ends * 1000).toISOString()}.`,
          );
          await service(context, `/api/factory/calendar/${phase}`, "PUT", {
            ...(phase === "frontier" ? { presetId: Number(context.inputs!.frontierPresetId) } : {}),
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
        const payer = context.target.coldAdmin ? context.inputs!.admin! : account.address;
        const mint = await shortfallMint(account, lords, payer, pool, state.block);
        const calls = buildFrontierFundingCalls(context.assets!.ledger, lords, {
          shard: state.shard.chainId,
          frontierSeasonId: state.gameId,
          presetId: state.native.presetId,
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
          detail: `wait for confirmed published pool${blitzPresetOf(context.target) === null ? "" : ", automatic Blitz slot"} and healthy relay/monitor`,
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
  const snapshot = await readConfirmedSnapshot(state.shard, releaseInputs(context)!.public_herald_url, state.gameId, [
    "LordsBudget",
    "FrontierPrize",
  ]);
  const budget = optionalRow(snapshot, "LordsBudget");
  if (!budget || BigInt(String(budget.pool)) === 0n) return false;
  const prize = optionalRow(snapshot, "FrontierPrize");
  if (
    BigInt(String(budget.pool)) !== BigInt(state.pool!.pool) / WEI ||
    !prize ||
    BigInt(String(prize.pool)) !== BigInt(state.pool!.prizePool) / WEI
  )
    throw new PublicError("Published pool differs from the deposit");
  if (blitzPresetOf(context.target) !== null) {
    const slots = await service<{ slots: unknown[] }>(context, "/api/slots");
    if (!slots.slots.length) return false;
  }
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
