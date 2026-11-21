import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { RACE_CLAIM_WINDOW_SECONDS } from "@realms-world/value-ledger";

const worldSources = new URL("../../../contracts/l3/world-native/src/", import.meta.url);
const rewardsClass = new URL("../../../contracts/l2/ledger/src/race.cairo", import.meta.url);
const GLORY_WRITE = /race_members\.write\(|emit\('RaceMember'|race\.credit\(|DeepRaceTrait::credit\(/g;

function cairoFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return cairoFiles(new URL(`${entry.name}/`, directory));
    return entry.name.endsWith(".cairo") ? [new URL(entry.name, directory)] : [];
  });
}

const gloryWriteSites = () =>
  cairoFiles(worldSources)
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(GLORY_WRITE)].map(
        ([site]) => `${file.pathname.slice(worldSources.pathname.length)} ${site}`,
      ),
    )
    .sort();

it("credits Glory only from Deep site payments, the one play the race rewards pay for", () => {
  expect(gloryWriteSites()).toEqual([
    "logic/deep_ticks.cairo race.credit(",
    "logic/race.cairo emit('RaceMember'",
    "logic/race.cairo race_members.write(",
  ]);
});

it("waits as long as the rewards class does before sweeping unpaid rewards", () => {
  expect(readFileSync(rewardsClass, "utf8")).toContain(
    `pub const RACE_CLAIM_WINDOW_SECONDS: u64 = ${RACE_CLAIM_WINDOW_SECONDS};`,
  );
});
