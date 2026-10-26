import { readFileSync, writeFileSync } from "node:fs";

// In world-native, record with scarb test record_spatial_replay --ignored,
// then pass that log here. Normal tests compare the same executed commands against these fixtures.
const log = readFileSync(process.argv[2], "utf8");
for (const name of ["armies", "buildings"]) {
  const records = [...log.matchAll(new RegExp(`SPATIAL_REPLAY ${name} \\[([^\\]]+)\\]`, "g"))];
  if (records.length !== 1) throw new Error(`Expected one ${name} replay`);
  const fields = records[0][1].split(",").map((field) => BigInt(field.trim()).toString());
  let index = 0;
  const next = () => {
    if (index >= fields.length) throw new Error(`Truncated ${name} replay`);
    return Number(fields[index++]);
  };
  const span = () => {
    const count = next();
    index += count;
  };
  const frames = next();
  if (frames !== 5) throw new Error(`Expected five ${name} frames`);
  for (let frame = 0; frame < frames; frame++) {
    const events = next();
    for (let event = 0; event < events; event++) {
      span();
      span();
    }
    const rows = next();
    for (let row = 0; row < rows; row++) {
      next();
      span();
      span();
    }
  }
  if (index !== fields.length) throw new Error(`Invalid ${name} replay length`);
  writeFileSync(new URL(`../src/tests/fixtures/spatial-replay/${name}.txt`, import.meta.url), fields.join("\n") + "\n");
  console.log(`Recorded ${name}: ${frames} frames, ${fields.length} felts`);
}
