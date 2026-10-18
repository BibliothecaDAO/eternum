import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBuildingModel } from "../../apps/game/scripts/render-building-thumbnails.mjs";
import { runProof } from "../../apps/game/scripts/prove-run.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const root = `${repo}/apps/game/asset-sources/facets`;
const file = `${root}/catalog.json`;
const catalog = JSON.parse(readFileSync(file, "utf8"));
const baseUrl = process.argv[2] ?? "https://127.0.0.1:4193";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
await runProof(
  {
    parent: resolve(process.argv[3] ?? ".context/icon-models"),
    name: "icon-models",
    baseUrl,
    where: (r) => ({ name: r.name }),
  },
  async (b, out, records) => {
    await b.run("open", `${baseUrl}/lab/kit/resource-icons`, "--ignore-https-errors");
    for (const { id, source } of catalog.icons.filter((icon) => icon.source?.model)) {
      const data = await b.evaluate(`(${renderBuildingModel.toString()})(${JSON.stringify(source.model)},1024)`);
      const bytes = Buffer.from(data.split(",")[1], "base64");
      writeFileSync(`${root}/masters/${id}.png`, bytes);
      writeFileSync(`${out}/${id}.png`, bytes);
      source.sha256 = hash(bytes);
      for (const input of Object.keys(source.inputs)) source.inputs[input] = hash(readFileSync(`${repo}/${input}`));
      records.push({ name: id, ready: true, presses: [], model: source.model });
    }
    writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    await b.run("open", "about:blank");
  },
);
