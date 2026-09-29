import { writeFileSync } from "node:fs";
import { hash } from "starknet";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { FRONTIER_PRESET_ID } from "../../../../config/source/common/native-preset-modes";

const realmIds = [1, 2, 3, 4, 5, 6, 7, 8, 3999, 4000, 7999, 8000];
const config = loadNativePresetConfiguration("madara.frontier", FRONTIER_PRESET_ID);
const { structures } = buildNativePreset(config, FRONTIER_PRESET_ID);
const highestRing = structures.upgrade_limits.realm_max + 1;
const lines = [`1\n${realmIds.length * highestRing}`];
for (const realmId of realmIds) {
  for (let ring = 1; ring <= highestRing; ring++) {
    const index = Number(BigInt(hash.computePoseidonHashOnElements([realmId, ring])) % BigInt(6 * ring));
    let col = 10 + ring;
    let row = 10;
    const directions = [2, 3, 4, 5, 0, 1];
    for (let step = 0; step < index; step++) {
      const direction = directions[Math.floor(step / ring)]!;
      const east = row % 2 === 0 ? 1 : 0;
      col += [1, east, east - 1, -1, east - 1, east][direction]!;
      row += [0, 1, 1, 0, -1, -1][direction]!;
    }
    lines.push(`${realmId}\n${ring}\n${col}\n${row}`);
  }
}
writeFileSync(new URL("../tests/fixtures/frontier-ring-v1.txt", import.meta.url), lines.join("\n") + "\n");
