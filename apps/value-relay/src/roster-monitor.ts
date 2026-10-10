import {
  resolveBlitzRoster,
  splitPlaytestRoster,
  readRegistrationPage,
  rpcAt,
  readRegisteredShard,
  readBlitzRoster,
  type RegistrationIdentity,
  type ShardDirectory,
  type SlotCohort,
} from "@realms-world/value-ledger";
import { ShardReader } from "./shard-rpc";

/** The same historical resolver checks both the pairs and eligible payers omitted from all of a slot's games. */
export async function checkSlotRoster(
  cohort: SlotCohort,
  ports: {
    registrations: () => Promise<import("@realms-world/value-ledger").SlotRegistration[]>;
    identity: RegistrationIdentity;
    roster: (gameId: number) => Promise<{ wallet: string; account: string }[]>;
    pause: () => Promise<void>;
  },
) {
  if (!cohort.complete) throw new Error("slot_creation_unverified");
  const { players } = await resolveBlitzRoster(await ports.registrations(), ports.identity);
  const groups = splitPlaytestRoster(players);
  const rosters = await Promise.all(cohort.games.map((game) => ports.roster(game.gameId)));
  const matches =
    cohort.games.length === groups.length &&
    cohort.games.every((game, index) => {
      const expected = groups[game.groupIndex];
      const actual = rosters[index]!;
      return (
        game.groupIndex === index &&
        expected?.length === actual.length &&
        actual.every(
          (row, i) =>
            BigInt(row.wallet) === BigInt(expected[i]!.wallet) && BigInt(row.account) === BigInt(expected[i]!.account),
        )
      );
    });
  if (!matches) {
    await ports.pause();
    throw new Error("slot_roster_mismatch");
  }
}

export const slotRosterReads = (
  cohort: SlotCohort,
  rpcUrl: string,
  ledger: string,
  identity: ShardDirectory & RegistrationIdentity,
) => ({
  identity,
  registrations: async () => {
    const provider = rpcAt(rpcUrl);
    let page = await readRegistrationPage(provider, ledger, cohort);
    if (page.secondsUntilClose) throw new Error("slot_registration_open");
    const rows = [...page.registrations];
    const { blockNumber, blockHash, slot } = page;
    while (page.next !== null) {
      page = await readRegistrationPage(provider, ledger, { ...cohort, from: page.next, blockNumber, blockHash });
      rows.push(...page.registrations);
    }
    if (rows.length !== slot.registeredCount) throw new Error("registration_history_incomplete");
    return rows;
  },
  roster: async (gameId: number) => {
    const shard = await readRegisteredShard(identity, cohort.chainId);
    const reader = new ShardReader({
      rpcUrl: shard.rpcUrl,
      chainId: shard.chainId,
      gamesAddress: shard.contracts.games!,
    });
    const head = await reader.head();
    return readBlitzRoster(reader.provider(), shard.contracts.games!, gameId, head);
  },
});
