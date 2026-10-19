import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeMaster, assertIconFill, deliverIcon } from "./normalize.mjs";
import { validateIconFiles } from "./files.mjs";
import { buildRewardChests } from "./reward-chests.mjs";
import { validateIcons } from "./validate.mjs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/facets`;
const read = async (file) => JSON.parse(await readFile(`${source}/${file}.json`, "utf8"));
const [{ icons }, meanings, resources, verdicts] = await Promise.all([
  read("catalog"),
  read("semantic-map"),
  read("resources"),
  read("verdicts"),
]);
validateIcons({ icons, meanings, resources, verdicts });
for (const { token, label } of Object.values(meanings).filter((entry) => entry.token))
  await assertIconFill(`${repo}/apps/game/public/tokens/${token}.svg`, `official ${label}`);
const rewardIds = [
  ...new Set(Object.values(meanings).flatMap((entry) => (entry.rewardChest ? [entry.rewardChest] : []))),
];
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
for (const id of requested)
  if (!icons.some((icon) => icon.id === id) && !rewardIds.includes(id)) throw new Error(`Unknown painting: ${id}`);
await buildRewardChests(`${repo}/apps/game`, meanings, { check: process.argv.includes("--check"), requested });
const output = `${repo}/apps/game/public/icons/facets`;
await validateIconFiles(icons, source, process.argv.includes("--check") ? output : undefined);
if (!process.argv.includes("--check")) {
  for (const size of [64, 128, 256]) await mkdir(`${output}/${size}`, { recursive: true });
  for (const icon of icons.filter((icon) => !requested.length || requested.includes(icon.id))) {
    const master = await normalizeMaster(`${source}/masters/${icon.id}.png`);
    for (const size of [64, 128, 256])
      await writeFile(`${output}/${size}/${icon.id}.webp`, await deliverIcon(master, size, icon.id));
  }
  await writeFile(`${output}/manifest.json`, JSON.stringify({ meanings, resources }, null, 2));
}
console.log(`${icons.length} paintings, ${Object.keys(meanings).length} meanings, all 58 resources validated.`);
