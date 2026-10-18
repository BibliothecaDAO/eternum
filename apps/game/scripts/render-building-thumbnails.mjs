import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof } from "./prove-run.mjs";
import sharp from "sharp";
import { normalizeMaster, assertIconFill } from "../../../scripts/icons/normalize.mjs";

/** Runs inside the client origin so it uses the game's Draco, Meshopt and KTX2 loader. */
export async function renderBuildingModel(model, pixels = 768) {
  const { renderModel } = await import(new URL("/src/ui/features/debug/kit-lab/render-model.ts", location.origin).href);
  return renderModel(model, pixels);
}

/** Construction artwork follows the same readable subject-fill rule as the painted icons. */
export async function normalizeBuildingThumbnail(bytes) {
  const master = await normalizeMaster(bytes);
  const png = await sharp(master).resize(384, 384).png().toBuffer();
  await assertIconFill(png, "building thumbnail");
  return png;
}

const game = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Against the running client: node scripts/render-building-thumbnails.mjs <base-url> <evidence-directory> [model-path]. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const selectedModel = process.argv[4];
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4193";
  const manifestFile = resolve(game, "asset-sources/building-thumbnails.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/building-thumbnails"),
      name: "building-thumbnails",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      b.run("open", `${baseUrl}/`, "--ignore-https-errors");
      for (const [image, entry] of Object.entries(manifest)) {
        if (selectedModel && entry.model !== selectedModel) continue;
        const data = await b.evaluate(`(${renderBuildingModel.toString()})(${JSON.stringify(entry.model)})`);
        const png = await normalizeBuildingThumbnail(Buffer.from(data.split(",")[1], "base64"));
        const destination = resolve(game, `public${image}`);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, png);
        entry.modelSha256 = createHash("sha256")
          .update(readFileSync(resolve(game, `public${entry.model}`)))
          .digest("hex");
        entry.imageSha256 = createHash("sha256").update(png).digest("hex");
        records.push({ name: image, ready: true, presses: [], model: entry.model });
      }
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      b.run("open", "about:blank");
    },
  );
}
