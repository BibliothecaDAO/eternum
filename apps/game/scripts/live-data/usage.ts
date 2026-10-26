// The pull's usage.json for the lab's Data → UI usage: its Games events decoded with Herald's own decoder, every
// transaction named by its command, then counted. live-data.py runs it after each analysis:
//   bun usage.ts <pull folder> <raw folder>
import { createReadStream, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { NativeDecoder } from "../../../herald/src/native/decoder";
import { type DecodedEvent, type Mode, nameCommands, peakHoldings } from "./commands";
import { Counts, type LeaderboardEntry, usageReport } from "./findings";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
/** Felts as hex strings and enums as plain objects, so commands.ts reads one JSON shape. */
const plain = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_, v) => (typeof v === "bigint" ? `0x${v.toString(16)}` : v)));

function decoderFor(schema: any, gamesContract: string, releaseSchemas: Record<string, string>) {
  return new NativeDecoder({
    world: { address: gamesContract },
    native: {
      version: 2,
      deploymentBlock: 0,
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
      logic: schema.logicClasses,
      releaseSchemas,
    },
  } as never);
}

/** One Games contract's published event segments (live-data.py's pull_events), oldest first; a .part is never read. */
function segmentsOf(raw: string, gamesContract: string) {
  const folder = join(raw, "games-events", `0x${BigInt(gamesContract).toString(16)}`);
  return readdirSync(folder)
    .map((name) => ({ name, match: /^(\d+)-(\d+)\.jsonl\.gz$/.exec(name) }))
    .filter(({ match }) => match)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]))
    .map(({ name }) => join(folder, name));
}

async function decodeEvents(raw: string, folder: string, throughBlock: number) {
  const manifest = readJson(join(folder, "manifest.json"));
  const contract: string = manifest.contracts.games;
  const decoder = decoderFor(readJson(join(folder, "schema.json")), contract, manifest.releaseSchemas);
  const events: DecodedEvent[] = [];
  const failures = new Map<string, number>();
  for (const segment of segmentsOf(raw, contract)) {
    for await (const line of createInterface({ input: createReadStream(segment).pipe(createGunzip()) })) {
      const event = JSON.parse(line);
      if (event.block_number > throughBlock) continue;
      try {
        const decoded = decoder.decode({ ...event, from_address: contract });
        events.push({
          block: event.block_number,
          tx: event.transaction_hash,
          ei: event.event_index,
          kind: decoded.kind as DecodedEvent["kind"],
          model: decoded.model.name,
          member: "member" in decoded ? decoded.member : undefined,
          key: plain(decoded.key),
          value: "value" in decoded ? plain(decoded.value) : undefined,
        });
      } catch (error) {
        const reason = (error as Error).message;
        failures.set(reason, (failures.get(reason) ?? 0) + 1);
      }
    }
  }
  return { events: events.sort((a, b) => a.block - b.block), failures };
}

/** Some events did not decode: counting the rest would read a schema change as a control nobody used. */
export class IncompleteDecode extends Error {
  constructor(readonly failures: Map<string, number>) {
    const total = [...failures.values()].reduce((sum, count) => sum + count, 0);
    super(
      `${total} ${total === 1 ? "event" : "events"} did not decode (${[...failures].map(([reason, count]) => `${reason}: ${count}`).join("; ")}); usage.json left as it was`,
    );
  }
}

/** Writes the pull's usage.json, replacing it only once every event through the pull's block has decoded. */
export async function writeUsage(folder: string, raw: string) {
  const throughBlock = Number(readJson(join(folder, "history.json")).complete_through_block);
  const modes: Record<string, Mode> = Object.fromEntries(
    readJson(join(folder, "games.json")).games.map((game: { game_id: number; mode: Mode }) => [
      String(game.game_id),
      game.mode,
    ]),
  );
  const leaderboard: LeaderboardEntry[] = readJson(join(folder, "leaderboard.json")).entries;
  const { events, failures } = await decodeEvents(raw, folder, throughBlock);
  if (failures.size) throw new IncompleteDecode(failures);
  const rows = nameCommands(events, modes);
  const counts = new Counts(rows, peakHoldings(events, modes), leaderboard);
  const pulled = readJson(join(folder, "pulled.json")).at.slice(0, 16).replace("T", " ") + " UTC";
  writeFileSync(join(folder, "usage.json.part"), JSON.stringify(usageReport(counts, pulled, throughBlock), null, 1));
  renameSync(join(folder, "usage.json.part"), join(folder, "usage.json"));
  return rows.length;
}

// Run by bun from live-data.py; a test imports writeUsage without running it.
if ((import.meta as { main?: boolean }).main) {
  const [folder, raw] = process.argv.slice(2);
  try {
    console.error(`usage: ${await writeUsage(folder, raw)} transactions named, ${join(folder, "usage.json")}`);
  } catch (error) {
    console.error(`usage: ${(error as Error).message}`);
    process.exit(1);
  }
}
