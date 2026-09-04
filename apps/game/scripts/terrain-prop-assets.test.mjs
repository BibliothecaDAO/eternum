// @vitest-environment node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";

import {
  ULTIMATE_NATURE_ARCHIVE_URL,
  ULTIMATE_NATURE_CANOPY_IDS,
  ULTIMATE_NATURE_LICENSE,
  ULTIMATE_NATURE_MAX_GLB_BYTES,
  ULTIMATE_NATURE_PROPS,
  ULTIMATE_NATURE_SOURCE_PAGE,
} from "./terrain-props/ultimate-nature-catalog.mjs";
import {
  CANOPY_SILHOUETTE_MIN_RETENTION,
  extractCanopyGeometry,
  measureLodSilhouetteRetention,
} from "./terrain-props/terrain-prop-silhouette.mjs";

const ASSET_DIRECTORY = new URL("../public/models/procedural-terrain/", import.meta.url);
const MANIFEST_PATH = new URL("ultimate-nature-props.json", ASSET_DIRECTORY);
const MODEL_PATH = new URL("ultimate-nature-props.glb", ASSET_DIRECTORY);

describe("generated Ultimate Nature terrain assets", () => {
  it("matches its checked-in provenance and transfer contract", async () => {
    const [manifestBytes, modelBytes] = await Promise.all([readFile(MANIFEST_PATH), readFile(MODEL_PATH)]);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));

    expect(manifest.source).toMatchObject({
      sourcePage: ULTIMATE_NATURE_SOURCE_PAGE,
      archiveUrl: ULTIMATE_NATURE_ARCHIVE_URL,
      license: ULTIMATE_NATURE_LICENSE,
    });
    expect(manifest.entries.map(({ id }) => id)).toEqual(ULTIMATE_NATURE_PROPS.map(({ id }) => id));
    expect(manifest.output.bytes).toBe(modelBytes.byteLength);
    expect(manifest.output.bytes).toBeLessThanOrEqual(ULTIMATE_NATURE_MAX_GLB_BYTES);
    expect(manifest.output.sha256).toBe(sha256(modelBytes));
  });

  it("contains exactly the allowlisted LOD meshes and no texture payload", async () => {
    const gltf = readGlbJson(await readFile(MODEL_PATH));
    const expectedMeshNames = ULTIMATE_NATURE_PROPS.flatMap(({ id }) => [`${id}-near`, `${id}-far`]);

    expect(gltf.meshes.map(({ name }) => name)).toEqual(expectedMeshNames);
    expect(gltf.nodes).toHaveLength(expectedMeshNames.length);
    expect(gltf.materials).toHaveLength(1);
    expect(gltf.textures ?? []).toHaveLength(0);
    expect(gltf.images ?? []).toHaveLength(0);
    expect(gltf.extensionsRequired).toEqual(
      expect.arrayContaining(["EXT_meshopt_compression", "KHR_mesh_quantization"]),
    );
  });

  it("preserves projected canopy coverage across the far LOD", async () => {
    await MeshoptDecoder.ready;
    const document = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
      .read(fileURLToPath(MODEL_PATH));
    const meshesByName = new Map(
      document
        .getRoot()
        .listMeshes()
        .map((mesh) => [mesh.getName(), mesh]),
    );

    for (const id of ULTIMATE_NATURE_CANOPY_IDS) {
      const near = meshesByName.get(`${id}-near`);
      const far = meshesByName.get(`${id}-far`);
      expect(near, `${id} near LOD`).toBeDefined();
      expect(far, `${id} far LOD`).toBeDefined();
      const retention = measureLodSilhouetteRetention(extractCanopyGeometry(near), extractCanopyGeometry(far));

      expect(retention.minimum, `${id} silhouette retention ${JSON.stringify(retention)}`).toBeGreaterThanOrEqual(
        CANOPY_SILHOUETTE_MIN_RETENTION,
      );
    }
  });
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readGlbJson(glb) {
  expect(glb.toString("ascii", 0, 4)).toBe("glTF");
  expect(glb.readUInt32LE(4)).toBe(2);

  const jsonChunkLength = glb.readUInt32LE(12);
  const jsonChunkType = glb.toString("ascii", 16, 20);
  expect(jsonChunkType).toBe("JSON");

  return JSON.parse(glb.toString("utf8", 20, 20 + jsonChunkLength).trim());
}
