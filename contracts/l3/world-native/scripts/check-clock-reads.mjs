import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAW_CLOCKS = [
  {
    read: /SWITCHES\.day_unit_seconds(?!\s*!=\s*0)/g,
    owner: "clock.cairo",
    use: "crate::clock::day_unit_seconds(game)",
  },
  { read: /TICK_CONFIG(?!\.delivery_tick_in_seconds)/g, owner: "clock.cairo", use: "crate::clock::tick_config(game)" },
  { read: /RELIC_SECONDS_PER_RANK/g, owner: "clock.cairo", use: "crate::clock::relic_seconds_per_rank(game)" },
  {
    read: /production_rate\s*[+-]=/g,
    owner: join("logic", "resources.cairo"),
    use: "start_production and stop_production, which scale a rate by the game's clock",
  },
];

const handWritten = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((path) => path.endsWith(".cairo") && !path.startsWith(`tests${"/"}`))
    .map((path) => ({ path, text: readFileSync(join(dir, path), "utf8") }))
    .filter(({ text }) => !text.split("\n", 1)[0].includes("@generated"));

export function rawClockReads(dir) {
  return handWritten(dir).flatMap(({ path, text }) =>
    RAW_CLOCKS.filter(({ read, owner }) => path !== owner && text.match(read)).map(
      ({ owner, use }) => `${path} reads a clock its game may scale outside ${owner}: use ${use}`,
    ),
  );
}

export const worldSource = fileURLToPath(new URL("../src", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const refusals = rawClockReads(worldSource);
  if (refusals.length > 0) {
    console.error(refusals.join("\n"));
    process.exit(1);
  }
  console.log("Every clock is read through crate::clock");
}
