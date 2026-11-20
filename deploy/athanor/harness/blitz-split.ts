import { parseArgs } from "node:util";
import { CallData, hash } from "starknet";
import schema from "../../../contracts/l3/world-native/schema/schema.json";
import { splitPlaytestRoster } from "../../../packages/value-ledger/src/blitz-roster";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "../../../packages/value-ledger/src/blitz-timetable";
import { seaterLabels } from "../../../packages/value-ledger/src/shard-accounts";
import { buildLaunchGameParams, type BlitzLaunch } from "../../../apps/launch-service/src/shard-client";
import { save } from "./burst-evidence";

const GAME_SECONDS = 3_600;

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { players: { type: "string" }, out: { type: "string" } } });
  const players = Number(values.players);
  if (!Number.isInteger(players) || players < 1 || !values.out) throw new Error("Usage: --players N --out FILE");
  writeDryRun(players, values.out);
}

/** Compile the launcher's actual game payloads without joining accounts or contacting a shard. */
function writeDryRun(players: number, out: string): void {
  const seaters = seaterLabels.map((_, index) => `0x${(index + 1).toString(16)}`);
  const launches = slotLaunches(players, seaters, Date.now());
  const codec = new CallData([...Object.values(schema.types), ...schema.games.entrypoints]);
  save(out, {
    dryRun: true,
    players,
    games: launches.map(({ request, createdAt, players, seater }) => {
      const params = buildLaunchGameParams(request, createdAt, players, seater);
      return {
        name: request.gameName,
        presetId: params.preset_id,
        players: players.length,
        calldata: codec.compile("create_game", { params }),
      };
    }),
  });
}

/** A closed slot of PLAYERS as the Worker launches it: the production split, each group's seater dealt by its index. */
export function slotLaunches(players: number, seaters: readonly string[], runStartedAt: number): BlitzLaunch[] {
  const run = runStartedAt.toString(36);
  return splitPlaytestRoster(syntheticRoster(players, BigInt(runStartedAt))).map((roster, groupIndex) =>
    blitzLaunch(run, groupIndex, roster, seaters[groupIndex % seaters.length]!),
  );
}

/** One game of the slot: settling opens now, play in the preparation window's length, as a closed slot's games do. */
function blitzLaunch(run: string, groupIndex: number, roster: string[], seater: string): BlitzLaunch {
  const startsAt = Math.ceil(Date.now() / 1000) + BLITZ_SLOT_PREPARATION_SECONDS;
  return {
    request: {
      environment: "madara.blitz",
      gameName: `split-${run}-${groupIndex + 1}`,
      gameStartTime: new Date(startsAt * 1000).toISOString(),
      durationSeconds: GAME_SECONDS,
    },
    players: roster.map((account) => ({ account, wallet: account })),
    createdAt: Date.now(),
    seater,
  };
}

/** Distinct, valid contract addresses that belong to nobody. */
const syntheticRoster = (count: number, run: bigint) =>
  Array.from({ length: count }, (_, index) => hash.computePoseidonHashOnElements([run, BigInt(index)])).map(
    (value) => `0x${(BigInt(value) % ((1n << 251n) - 256n)).toString(16)}`,
  );

if (import.meta.main) await main();
