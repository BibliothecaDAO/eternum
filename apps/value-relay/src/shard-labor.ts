import { dayOf } from "../../../packages/core/src/utils/days";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import type { CairoOption } from "starknet";
import { ShardReader, sameFelt, felt, uint, type ShardConnection } from "./shard-rpc";
import { relayOperation, type LaborClaim, type LaborGrant, type RelayEffect } from "./ports";

interface LaborTarget {
  connection: ShardConnection;
  operatorAddress: string;
  privateKey: string;
}
type RecordedGrant = { game_id: bigint; account: bigint; home: bigint; amount: bigint; essence: bigint };

export const currentLaborDay = (connection: ShardConnection, heraldUrl: string, gameId: number): RelayEffect<number> =>
  relayOperation("read Frontier labor day", async () => {
    const snapshot = await readConfirmedSnapshot(connection, heraldUrl, gameId, ["GameRegistry", "SliceRules"]);
    const game = singleRow(snapshot, "GameRegistry");
    const rules = singleRow(snapshot, "SliceRules");
    const { timestamp } = await new ShardReader(connection).header("latest");
    const day = dayOf(
      {
        seed: BigInt(String(game.seed)),
        startMainAt: Number(game.start_main_at),
        dayUnitSeconds: Number(rules.day_unit_seconds),
      },
      timestamp,
    );
    if (!day || timestamp >= Number(game.end_at)) throw new Error("labor_outside_season");
    return day.index;
  });

export const writeLaborGrant = (target: LaborTarget, claim: LaborClaim) =>
  relayOperation("write home labor grant", async (): Promise<LaborGrant> => {
    if (!sameFelt(claim.chainId, target.connection.chainId)) throw new Error("labor_chain_differs");
    const home = { game_id: Number(uint(String(claim.gameId), 32)), home: uint(claim.home, 64) };
    uint(String(claim.day), 64);
    if (!home.game_id || !home.home || !BigInt(felt(claim.account))) throw new Error("invalid_labor_claim");
    const operator = new ShardOperator({
      ...target.connection,
      accountAddress: target.operatorAddress,
      privateKey: target.privateKey,
    } satisfies ShardTarget);
    if ((await operator.view<bigint>("ledger_operator", [])) !== BigInt(felt(target.operatorAddress)))
      throw new Error("only_ledger_operator");
    const read = () => operator.view<CairoOption<RecordedGrant>>("labor_grant", [home.game_id, home.home, claim.day]);
    let grant = (await read()).unwrap();
    if (!grant) {
      await operator.admin("grant_labor", { home, day: claim.day, account: claim.account });
      grant = (await read()).unwrap();
    }
    if (!grant) throw new Error("labor_grant_not_recorded");
    if (
      Number(grant.game_id) !== claim.gameId ||
      grant.account !== BigInt(felt(claim.account)) ||
      grant.home !== home.home
    )
      throw new Error("labor_already_claimed");
    return {
      gameId: Number(grant.game_id),
      account: felt(claim.account),
      home: String(grant.home),
      amount: String(grant.amount),
      essence: String(grant.essence),
    };
  });
