import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const source = `${repo}/apps/game/asset-sources/facets`;
const { icons } = JSON.parse(await readFile(`${source}/catalog.json`, "utf8"));
for (const { id, source: origin } of icons.filter((icon) => icon.source?.revision)) {
  const bytes = execFileSync("git", ["show", `${origin.revision}:${origin.path}`], { cwd: repo });
  if (createHash("sha256").update(bytes).digest("hex") !== origin.sha256)
    throw new Error(`Pinned source changed: ${id}`);
  await writeFile(`${source}/masters/${id}.png`, bytes);
  console.log(`Restored ${id}`);
}
