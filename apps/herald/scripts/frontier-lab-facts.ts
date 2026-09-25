/**
 * Writes the recorded Frontier launch's configuration facts in the client's wire form, for the game client's dev-only
 * Frontier HUD lab. The rows come from the committed preset-projection recording, decoded by Herald's own decoder, so
 * the lab always shows the current recording under the current schema. Usage: bun frontier-lab-facts.ts <out.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { shortString } from "starknet";
import { toJsonValue } from "../src/model-registry";
import { NativeDecoder } from "../src/native/decoder";
import { manifest } from "../src/native/fixtures";

const RECORDING = new URL(
  "../../../contracts/l3/world-native/tests/fixtures/preset-projection/frontier-rows.txt",
  import.meta.url,
);

const readRecordedRows = () => {
  const felts = readFileSync(RECORDING, "utf8").trim().split(/\s+/);
  let index = 0;
  const next = () => {
    const felt = felts[index++];
    if (felt === undefined) throw new Error("Truncated Frontier launch recording");
    return felt;
  };
  const span = () => Array.from({ length: Number(next()) }, next);
  const rows = Array.from({ length: Number(next()) }, () => ({
    model: shortString.decodeShortString(next()),
    keys: span(),
    values: span(),
  }));
  if (index !== felts.length) throw new Error("Trailing values in the Frontier launch recording");
  return rows;
};

const toWireFacts = (rows: ReturnType<typeof readRecordedRows>) => {
  const decoder = new NativeDecoder(manifest);
  return rows.map(({ model, keys, values }) => {
    const row = decoder.decodeRowSet(model, keys, values);
    if (row.kind !== "set") throw new Error(`Recorded ${model} is not a complete fact`);
    return { model: row.model.name, value: toJsonValue({ ...row.key, ...row.value }) };
  });
};

const out = process.argv[2];
if (!out) throw new Error("Usage: bun frontier-lab-facts.ts <out.json>");
const target = resolve(out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(toWireFacts(readRecordedRows())));
console.log(`Wrote the recorded Frontier rules to ${target}`);
