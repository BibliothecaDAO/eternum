import { normalizeStarknetAddress } from "@realms-world/identity";
import { BLITZ_SLOT_PREPARATION_SECONDS, isDevShardChain } from "@realms-world/value-ledger";
import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";
import type { LaunchRun } from "./model";
import type { CreateGameRequest } from "./schemas";

/**
 * A test Blitz is a paid Blitz's preset, schedule and results with a roster the operator names instead of a ledger
 * slot, so a Blitz can be played without a mainnet transaction. It takes no entry and posts no result. Only a dev shard
 * runs one: the route and the executor both refuse any chain the shard deploy did not name as dev, whatever the
 * Worker's own configuration says.
 */
export interface TestBlitz {
  /** The request's durable identity, chosen by the operator: a retry under it returns the same game. */
  name: string;
  players: string[];
}

/** A Starknet short string holds 31 characters. */
const TEST_GAME_NAME = /^test-[a-z0-9-]{1,26}$/;
const ACCOUNT = /^0x[0-9a-fA-F]{1,64}$/;

/** The request's name and its distinct, non-zero player accounts, at most one game's roster; null for anything else. */
export const readTestBlitz = (body: unknown): TestBlitz | null => {
  const { name, players } = (body ?? {}) as { name?: unknown; players?: unknown };
  if (typeof name !== "string" || !TEST_GAME_NAME.test(name)) return null;
  if (!Array.isArray(players) || !players.every((player) => typeof player === "string" && ACCOUNT.test(player)))
    return null;
  const accounts = players.map((player: string) => normalizeStarknetAddress(player));
  const distinct = new Set(accounts).size === accounts.length;
  const fits = accounts.length > 0 && accounts.length <= nativeRuleConstants.MAX_BLITZ_ROSTER_PLAYERS;
  return distinct && fits && !accounts.includes("0x0") ? { name, players: accounts } : null;
};

/** It starts one preparation window after its first request, as a slot's games start after its close. */
export const testBlitzRequest = ({ name, players }: TestBlitz, now: number): CreateGameRequest => ({
  environment: "madara.blitz",
  gameName: name,
  gameStartTime: new Date((Math.ceil(now / 1000) + BLITZ_SLOT_PREPARATION_SECONDS) * 1000).toISOString(),
  players: [...players],
});

/** Whether the run under a test name is that same test game: no slot, and the same roster in the same order. */
export const isSameTestBlitz = (run: LaunchRun, { players }: TestBlitz) => {
  const held = "players" in run.request ? run.request.players : undefined;
  return (
    run.slotId === null && held?.length === players.length && held.every((player, index) => player === players[index])
  );
};

/** A game that pays nothing has no payout wallet, so each seat's wallet is its own account. */
export const testBlitzRoster = (request: CreateGameRequest, chainId: string) => {
  if (!isDevShardChain(chainId)) throw new Error("test_blitz_dev_shard_only");
  if (!request.players?.length) throw new Error("test_blitz_roster_missing");
  return request.players.map((account) => ({ account, wallet: account }));
};
