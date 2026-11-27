import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REALM_SUPPORT_SOURCE_FILES = [
  "src/three/structures/realm-support-kit.ts",
  "src/three/structures/realm-kit-primitives.ts",
  "src/three/structures/procgen-masonry-material.ts",
];

export function buildingThumbnailModelSha256(model, gameDir) {
  if (model.startsWith("procedural:realm-support:")) {
    const combined = Buffer.concat(REALM_SUPPORT_SOURCE_FILES.map((file) => readFileSync(resolve(gameDir, file))));
    return createHash("sha256").update(combined).digest("hex");
  }
  return createHash("sha256")
    .update(readFileSync(resolve(gameDir, `public${model}`)))
    .digest("hex");
}
