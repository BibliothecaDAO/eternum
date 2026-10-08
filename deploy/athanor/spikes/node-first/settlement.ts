import { existsSync, readFileSync } from "node:fs";
import type { RpcProvider } from "starknet";
import { mapWithConcurrency } from "../../harness/account-factory";
import { normalize, type Fixture } from "./common";

export async function settledHomes(provider: RpcProvider, fixture: Fixture) {
  const game = fixture.game!;
  const rows = await mapWithConcurrency(fixture.players, 32, async (player) => {
    const row = await provider.callContract(
      { contractAddress: fixture.contract, entrypoint: "settle_state", calldata: [game.id, player.address] },
      "pre_confirmed",
    );
    const seat =
      game.arm === "Y"
        ? (
            await provider.callContract(
              { contractAddress: fixture.contract, entrypoint: "seat", calldata: [game.id, player.address] },
              "pre_confirmed",
            )
          )[0]!
        : "0";
    return readSettledHome(row, player.address, game.arm, seat);
  });
  const homes = rows.filter((row) => row.id !== "0");
  const distinct = (field: "id" | "owner" | "realm" | "reference" | "site") =>
    new Set(homes.map((row) => row[field])).size;
  const [count] = await provider.callContract(
    { contractAddress: fixture.contract, entrypoint: "realm_count", calldata: [game.id] },
    "pre_confirmed",
  );
  const census = {
    homes: homes.length,
    owners: distinct("owner"),
    ids: distinct("id"),
    canonicalRealms: distinct("realm"),
    offMapReferences: distinct("reference"),
    daySites: distinct("site"),
  };
  const valid =
    rows.every((row) => row.valid) &&
    Object.values(census).every((value) => value === fixture.players.length) &&
    BigInt(count!) === BigInt(game.arm === "X" ? fixture.players.length : 0);
  return { valid, ...census, aggregateRealmCount: Number(BigInt(count!)), rows };
}
export function readSettledHome(row: string[], actor: string, arm: string, seat: string) {
  if (row.length !== 10) throw new Error("Unexpected settle-state wire");
  const values = row.map(BigInt);
  const id = values[0]!,
    realm = values[2]!;
  const owner = normalize(row[1]!);
  const reference = values.slice(3, 6).join(":"),
    site = values.slice(6, 9).join(":");
  const localId = arm !== "Y" || (id / 65536n === realm && id % 65536n === 1n && realm === BigInt(seat));
  const valid = id !== 0n && owner === normalize(actor) && realm > 0n && realm <= 8000n && localId && values[9] === 1n;
  return { id: id.toString(), owner, realm: realm.toString(), reference, site, valid };
}

// The final partial block closes after the last receipt. Its logs are collected outside the visibility timer.
export function settleCloseFootprint(file: string | undefined, offset: number, expected: number) {
  if (!file || !existsSync(file)) return { complete: false, missing: "node close log unavailable", blocks: [] };
  const blocks: Record<string, number>[] = [];
  for (const line of readFileSync(file, "utf8").slice(offset).split("\n")) {
    try {
      const row = JSON.parse(line);
      if (row.message !== "close_block_complete" || typeof row.tx_count !== "number" || row.tx_count === 0) continue;
      const fields = [
        "block_number",
        "tx_count",
        "event_count",
        "state_diff_len",
        "nonce_updates",
        "bouncer_state_diff_size",
        "l2_gas_consumed",
      ];
      if (fields.every((field) => typeof row[field] === "number"))
        blocks.push(Object.fromEntries(fields.map((field) => [field, row[field]])));
    } catch {
      /* A trailing log line may still be written. */
    }
  }
  const unique = [...new Map(blocks.map((row) => [row.block_number, row])).values()];
  const total = (field: string) => unique.reduce((sum, row) => sum + row[field]!, 0);
  const transactions = total("tx_count"),
    events = total("event_count"),
    stateEntries = total("state_diff_len"),
    nonces = total("nonce_updates"),
    bouncerUnits = total("bouncer_state_diff_size");
  const complete = transactions === expected;
  return {
    complete,
    contaminated: transactions > expected,
    transactions,
    events,
    stateEntries,
    nonceUpdates: nonces,
    storageEntries: stateEntries - nonces,
    bouncerUnits,
    eventsPerSettle: complete ? events / expected : null,
    stateEntriesPerSettle: complete ? stateEntries / expected : null,
    storageEntriesPerSettle: complete ? (stateEntries - nonces) / expected : null,
    bouncerUnitsPerSettle: complete ? bouncerUnits / expected : null,
    scope:
      "All pure-wave closes including final partial close; counts include per-block overhead, not individual storage syscalls",
    blocks: unique,
  };
}
