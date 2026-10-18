import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { assertIconFill, normalizeMaster, deliverIcon } from "./normalize.mjs";

export async function buildRewardChests(game, meanings, { check, requested = [] }) {
  const source = `${game}/asset-sources/reward-chests`;
  const output = `${game}/public/images/blitz-chests`;
  const { files, size } = JSON.parse(await readFile(`${source}.json`, "utf8"));
  const deliveries = [
    ...new Set(Object.values(meanings).flatMap(({ rewardChest }) => (rewardChest ? [`${rewardChest}.webp`] : []))),
  ].sort();
  if (JSON.stringify(deliveries) !== JSON.stringify(Object.keys(files).sort()))
    throw new Error("Reward chest sources must cover every semantic delivery exactly.");
  if (!check) await mkdir(output, { recursive: true });
  const present = (await readdir(output)).sort();
  if (present.some((file) => !deliveries.includes(file)) || (check && present.length !== deliveries.length))
    throw new Error("Reward chest output must contain only the registered deliveries.");
  for (const file of deliveries) {
    if (!check && requested.length && !requested.includes(file.replace(/\.webp$/, ""))) continue;
    const original = await readFile(`${source}/originals/${file}`);
    if (createHash("sha256").update(original).digest("hex") !== files[file].sha256)
      throw new Error(`Restore approved reward chest source: ${file}`);
    const delivery = `${output}/${file}`;
    if (check) await assertIconFill(delivery, `reward chest ${file}`);
    const bytes = await deliverIcon(await normalizeMaster(original), size, file);
    if (check) {
      if (!(await readFile(delivery)).equals(bytes))
        throw new Error(`Stale reward chest delivery: ${file}. Run pnpm icons:build ${file.replace(/\.webp$/, "")}.`);
    } else await writeFile(delivery, bytes);
  }
}
