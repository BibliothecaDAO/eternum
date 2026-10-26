import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { beforeEach, expect, it } from "vitest";
import { IncompleteDecode, writeUsage } from "./usage";

// The release's own schema, as prod's Herald serves it at /schemas/<identity>.
const SCHEMA = JSON.parse(
  readFileSync(join(__dirname, "../../../../contracts/l3/world-native/schema/schema.json"), "utf8"),
);
const GAMES = "0x56ea85ca3b4fc1a5b12c97fc2f683be170b09ed11b32c39bf294cfc0823b78";
const PREVIOUS = '{"title":"the last good report"}';
let raw: string;
let pull: string;
let segments: string;

/** A pull as live-data.py leaves it: the pull's files, and the contract's published event segments under raw/. */
beforeEach(() => {
  raw = mkdtempSync(join(tmpdir(), "usage-raw-"));
  pull = join(raw, "20261026T092830Z");
  segments = join(raw, "games-events", GAMES);
  mkdirSync(pull);
  mkdirSync(segments, { recursive: true });
  const files: Record<string, unknown> = {
    "history.json": { complete_through_block: 100 },
    "games.json": { games: [{ game_id: 1, mode: "frontier" }] },
    "leaderboard.json": { entries: [] },
    "pulled.json": { at: "2026-10-26T09:28:50+00:00" },
    "schema.json": SCHEMA,
    "manifest.json": { contracts: { games: GAMES }, releaseSchemas: { "1": SCHEMA.identity } },
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(pull, name), JSON.stringify(body));
  writeFileSync(join(pull, "usage.json"), PREVIOUS);
});
const segment = (name: string, events: unknown[]) =>
  writeFileSync(join(segments, name), gzipSync(events.map((event) => JSON.stringify(event)).join("\n")));

it("refuses to replace the report when an event does not decode", async () => {
  segment("0-100.jsonl.gz", [
    { block_number: 7, transaction_hash: "0x1", transaction_index: 0, event_index: 0, keys: ["0x123"], data: [] },
  ]);
  const written = writeUsage(pull, raw);
  await expect(written).rejects.toBeInstanceOf(IncompleteDecode);
  await expect(written).rejects.toThrow(
    "1 event did not decode (Unknown native event prefix: 1); usage.json left as it was",
  );
  expect(readFileSync(join(pull, "usage.json"), "utf8")).toBe(PREVIOUS);
});

it("writes the report from published segments only, never from a segment a stopped run left as .part", async () => {
  segment("0-100.jsonl.gz", []);
  writeFileSync(join(segments, "101-200.jsonl.gz.part"), "cut short");
  await expect(writeUsage(pull, raw)).resolves.toBe(0);
  const report = JSON.parse(readFileSync(join(pull, "usage.json"), "utf8"));
  expect(report.source).toContain("through block 100");
  expect(report.source).toContain("0 of 0 transactions named");
});
