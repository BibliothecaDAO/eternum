import { raceRewards, type RaceFacts, type RaceReward } from "./race-amounts";
import { ShardReader, type ShardConnection } from "./shard-rpc";
import { optionalRow, readConfirmedSnapshot, snapshotUint, type ConfirmedSnapshot } from "./shard-snapshot";

const RACE_MODELS = ["RaceResult", "AspectHyperstructure", "HomeAspect", "RaceMember", "Structure"] as const;

export interface OwedRaceReward extends RaceReward {
  owner: string;
}

export interface FinishedRace {
  total: bigint;
  rewards: OwedRaceReward[];
}

export async function readFinishedRace(
  connection: ShardConnection,
  heraldUrl: string,
  gameId: number,
  network: typeof fetch = fetch,
): Promise<FinishedRace | null> {
  const snapshot = await readConfirmedSnapshot(connection, heraldUrl, gameId, RACE_MODELS, network);
  const result = optionalRow(snapshot, "RaceResult");
  if (!result) return null;
  const confirmed = await new ShardReader(connection).header(snapshot.confirmed_block);
  if (BigInt(confirmed.timestamp) < snapshotUint(result.ended_at, 64)) return null;
  const { total, rewards } = raceRewards(raceFacts(snapshot, result.winner));
  const owners = homeOwners(snapshot);
  return { total, rewards: rewards.map((reward) => ({ ...reward, owner: ownerOf(owners, reward.home) })) };
}

function raceFacts(snapshot: ConfirmedSnapshot, winner: unknown): RaceFacts {
  const glory = new Map(
    rowsOf(snapshot, "RaceMember").map((row) => [snapshotUint(row.entity_id, 64), snapshotUint(row.glory, 128)]),
  );
  return {
    winner: winner === null ? null : Number(snapshotUint(winner, 8)),
    heights: rowsOf(snapshot, "AspectHyperstructure").map((row) => ({
      aspect: Number(snapshotUint(row.aspect, 8)),
      height: Number(snapshotUint(row.height, 32)),
    })),
    members: rowsOf(snapshot, "HomeAspect").map((row) => {
      const home = snapshotUint(row.home, 64);
      return { home, aspect: Number(snapshotUint(row.aspect, 8)), glory: glory.get(home) ?? 0n };
    }),
  };
}

function homeOwners(snapshot: ConfirmedSnapshot) {
  return new Map(
    rowsOf(snapshot, "Structure").map((row) => [snapshotUint(row.entity_id, 64), snapshotUint(row.owner, 252)]),
  );
}

function ownerOf(owners: ReadonlyMap<bigint, bigint>, home: bigint) {
  const owner = owners.get(home);
  if (!owner) throw new Error("race_home_unowned");
  return `0x${owner.toString(16)}`;
}

const rowsOf = (snapshot: ConfirmedSnapshot, name: (typeof RACE_MODELS)[number]) =>
  snapshot.models.find((model) => model.model === name)!.rows.map((row) => row.value);
