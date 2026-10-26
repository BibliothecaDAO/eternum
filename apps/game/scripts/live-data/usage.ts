// The pull's usage.json for the lab's Data → UI usage: its Games events decoded with Herald's own decoder, every
// transaction named by its command, then counted. live-data.py runs it after each analysis:
//   bun usage.ts <pull folder> <raw folder>
import { createReadStream, readFileSync, renameSync, writeFileSync } from "node:fs";
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

async function decodeEvents(raw: string, folder: string, throughBlock: number) {
  const { contract } = readJson(join(raw, "games-events.json"));
  const decoder = decoderFor(
    readJson(join(folder, "schema.json")),
    contract,
    readJson(join(folder, "manifest.json")).releaseSchemas,
  );
  const events: DecodedEvent[] = [];
  const failures = new Map<string, number>();
  const lines = createInterface({ input: createReadStream(join(raw, "games-events.jsonl.gz")).pipe(createGunzip()) });
  for await (const line of lines) {
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
  return { events: events.sort((a, b) => a.block - b.block), failures };
}

async function main([folder, raw]: string[]) {
  const throughBlock = Number(readJson(join(folder, "history.json")).complete_through_block);
  const modes: Record<string, Mode> = Object.fromEntries(
    readJson(join(folder, "games.json")).games.map((game: { game_id: number; mode: Mode }) => [
      String(game.game_id),
      game.mode,
    ]),
  );
  const leaderboard: LeaderboardEntry[] = readJson(join(folder, "leaderboard.json")).entries;
  const { events, failures } = await decodeEvents(raw, folder, throughBlock);
  // A decode failure means the schema no longer reads some events: say so rather than count around them.
  if (failures.size) console.error("usage: events the schema could not decode", Object.fromEntries(failures));
  const rows = nameCommands(events, modes);
  const counts = new Counts(rows, peakHoldings(events, modes), leaderboard);
  const report = usageReport(
    counts,
    readJson(join(folder, "pulled.json")).at.slice(0, 16).replace("T", " ") + " UTC",
    throughBlock,
  );
  writeFileSync(join(folder, "usage.json.part"), JSON.stringify(report, null, 1));
  renameSync(join(folder, "usage.json.part"), join(folder, "usage.json"));
  console.error(`usage: ${rows.length} transactions named, ${join(folder, "usage.json")}`);
}

await main(process.argv.slice(2));
