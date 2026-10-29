import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const game = fileURLToPath(new URL("../../", import.meta.url));
const read = async (path) => JSON.parse(await readFile(`${game}/${path}`, "utf8"));
const skins = await read("src/three/structures/realm-skins.json");
const tiers = (await read("src/three/structures/realm-assets.json")).filter((asset) => !asset.wonder);
for (const { directory } of Object.values(skins)) {
  for (const { id } of tiers) {
    const source = await readFile(`${game}/asset-sources/realms/devcon/${directory}/${id}.glb`);
    const delivery = withOwnershipCloth(source);
    const output = `${game}/public/models/realms/devcon/${directory}`;
    const path = `${output}/${id}.glb`;
    if (process.argv.includes("--check")) {
      if (!(await readFile(path)).equals(delivery)) throw new Error(`Stale Devcon delivery: ${path}`);
    } else {
      await mkdir(output, { recursive: true });
      await writeFile(path, delivery);
    }
  }
}

/** Only metadata changes: preserve the approved geometry, compressed textures and diamond UVs byte for byte. */
function withOwnershipCloth(source) {
  const jsonLength = source.readUInt32LE(12);
  const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  const banners = gltf.nodes.filter((node) => node.name?.startsWith("Devcon diamond banner"));
  if (!banners.length) throw new Error("Devcon realm has no separate banner cloth");
  for (const banner of banners) banner.extras = { ...banner.extras, orderCloth: "banner" };
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.from(source.subarray(0, 20));
  const binary = source.subarray(20 + jsonLength);
  header.writeUInt32LE(20 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12);
  return Buffer.concat([header, padded, binary]);
}
