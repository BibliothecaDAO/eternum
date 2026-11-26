import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { FRONTIER_BUILDING_TYPES } from "@bibliothecadao/types";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { MODEL_TYPE_TO_FILE } from "../../src/three/constants/army-constants";
import { FRONTIER_BEASTS } from "../../src/three/structures/frontier-beast";
import {
  FRONTIER_PAINTED_BUILDINGS,
  frontierPaintedBuildingPath,
} from "../../src/three/structures/frontier-painted-buildings";
import { DEEP_GATE_MODELS, DEEP_SITE_MODELS } from "../../src/three/structures/deep-landmarks";
import { ASPECT_WONDER_PATHS } from "../../src/three/structures/realm-design";
import { MODEL_BUDGETS, assertDeliveredAsset, readHexFit, shipTripoModel } from "./ship-model.mjs";

const CLI = fileURLToPath(new URL("./ship-model.mjs", import.meta.url));
const WELL_MODEL = fileURLToPath(new URL("../../public/models/frontier/painted/well.glb", import.meta.url));
const createdDirs = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "ship-model-test-"));
  createdDirs.push(dir);
  return dir;
}

function makeFitJson(scale, offset, yaw = 0) {
  return JSON.stringify({
    name: "test-model",
    kind: "board building",
    fit: "footprint",
    transform: {
      yaw_deg_about_y: yaw,
      scale,
      offset_xyz: offset,
    },
  });
}

async function createReader() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
}

async function extractKtx2Sample() {
  const io = await createReader();
  const doc = await io.read(WELL_MODEL);
  const texture = doc
    .getRoot()
    .listTextures()
    .find((entry) => entry.getMimeType() === "image/ktx2");
  if (!texture) throw new Error("Expected a KTX2 texture in well.glb");
  return Buffer.from(texture.getImage());
}

async function writeSyntheticGlb(targetPath, options = {}) {
  const {
    triangleCount = 12,
    width = 0.8,
    height = 0.6,
    depth = 0.8,
    baseY = 0,
    drawCalls = 1,
    colorPngSize,
    normalPngSize,
    ktx2ColorBytes,
    nodeTranslation = [0, 0, 0],
    nodeScale = [1, 1, 1],
  } = options;

  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc.createMaterial("surface").setRoughnessFactor(0.9).setMetallicFactor(0);

  if (ktx2ColorBytes) {
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    const texture = doc.createTexture("base-ktx2").setImage(ktx2ColorBytes).setMimeType("image/ktx2");
    material.setBaseColorTexture(texture);
  } else if (colorPngSize) {
    const png = await sharp({
      create: {
        width: colorPngSize,
        height: colorPngSize,
        channels: 4,
        background: { r: 120, g: 100, b: 80, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const texture = doc.createTexture("base-png").setImage(png).setMimeType("image/png");
    material.setBaseColorTexture(texture);
  }

  if (normalPngSize) {
    const png = await sharp({
      create: {
        width: normalPngSize,
        height: normalPngSize,
        channels: 4,
        background: { r: 128, g: 128, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const texture = doc.createTexture("normal-png").setImage(png).setMimeType("image/png");
    material.setNormalTexture(texture);
  }

  const mesh = doc.createMesh("body");
  const trisPerDraw = Math.max(1, Math.ceil(triangleCount / drawCalls));
  for (let draw = 0; draw < drawCalls; draw++) {
    const count = draw === drawCalls - 1 ? triangleCount - trisPerDraw * draw : trisPerDraw;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let t = 0; t < count; t++) {
      const f = count > 1 ? t / (count - 1) : 0;
      const yTop = baseY + height * (0.2 + 0.8 * f);
      const x0 = -width / 2;
      const x1 = width / 2;
      const z0 = -depth / 2;
      const z1 = depth / 2;
      const baseIndex = t * 3;
      positions.push(x0, baseY, z0, x1, baseY, z1, 0, yTop, 0);
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      uvs.push(0, 0, 1, 0, 0.5, 1);
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    }
    const indexArray = positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    const primitive = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute(
        "POSITION",
        doc.createAccessor().setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        doc.createAccessor().setType("VEC3").setArray(new Float32Array(normals)).setBuffer(buffer),
      )
      .setAttribute(
        "TEXCOORD_0",
        doc.createAccessor().setType("VEC2").setArray(new Float32Array(uvs)).setBuffer(buffer),
      )
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(indexArray).setBuffer(buffer));
    mesh.addPrimitive(primitive);
  }

  const node = doc.createNode("model").setMesh(mesh).setTranslation(nodeTranslation).setScale(nodeScale);
  doc.createScene("scene").addChild(node);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  await io.write(targetPath, doc);
}

describe("ship-model pipeline", () => {
  it("refuses a model when fit.json is missing or invalid", async () => {
    const dir = makeTempDir();
    const input = join(dir, "raw.glb");
    const out = join(dir, "shipped.glb");
    await writeSyntheticGlb(input);

    await expect(shipTripoModel({ input, kind: "building", out })).rejects.toThrow("Missing hex fit file");

    const missingTransform = join(dir, "no-transform.json");
    writeFileSync(missingTransform, JSON.stringify({ name: "x" }));
    expect(() => readHexFit(missingTransform)).toThrow("transform object");

    const badScaleFit = join(dir, "bad-scale.json");
    writeFileSync(badScaleFit, makeFitJson(0, [0, 0, 0]));
    expect(() => readHexFit(badScaleFit)).toThrow("transform.scale");

    const badOffsetFit = join(dir, "bad-offset.json");
    writeFileSync(badOffsetFit, makeFitJson(1, [0, 0]));
    expect(() => readHexFit(badOffsetFit)).toThrow("transform.offset_xyz");

    const flaggedFit = join(dir, "flagged.json");
    writeFileSync(flaggedFit, JSON.stringify({ ...JSON.parse(makeFitJson(1, [0, 0, 0])), flags: [] }));
    expect(() => readHexFit(flaggedFit)).toThrow('unsupported key "flags"');
  });

  it("refuses a model over its kind triangle, texture, draw or hex footprint budget", async () => {
    const dir = makeTempDir();
    const fit = join(dir, "fit.json");
    writeFileSync(fit, makeFitJson(1, [0, 0, 0], 0));

    const tooManyTris = join(dir, "over-tris.glb");
    await writeSyntheticGlb(tooManyTris, { triangleCount: MODEL_BUDGETS.building.maxTriangles + 1 });
    await expect(
      shipTripoModel({ input: tooManyTris, fit, kind: "building", out: join(dir, "out1.glb") }),
    ).rejects.toThrow("triangle count");

    const tooBigColor = join(dir, "over-color.glb");
    await writeSyntheticGlb(tooBigColor, { colorPngSize: MODEL_BUDGETS.building.maxColorTexture * 2 });
    await expect(
      shipTripoModel({ input: tooBigColor, fit, kind: "building", out: join(dir, "out2.glb") }),
    ).rejects.toThrow("exceeding building limit of 1024px");

    const tooBigNormal = join(dir, "over-normal.glb");
    await writeSyntheticGlb(tooBigNormal, { normalPngSize: MODEL_BUDGETS.building.maxTechnicalTexture * 2 });
    await expect(
      shipTripoModel({ input: tooBigNormal, fit, kind: "building", out: join(dir, "out3.glb") }),
    ).rejects.toThrow("exceeding building limit of 512px");

    const tooManyDraws = join(dir, "over-draws.glb");
    await writeSyntheticGlb(tooManyDraws, { drawCalls: MODEL_BUDGETS.building.maxDraws + 1 });
    await expect(
      shipTripoModel({ input: tooManyDraws, fit, kind: "building", out: join(dir, "out4.glb") }),
    ).rejects.toThrow("draw count");

    const outsideHexFit = join(dir, "wide-fit.json");
    writeFileSync(outsideHexFit, makeFitJson(3, [0, 0, 0], 0));
    const validRaw = join(dir, "valid.glb");
    await writeSyntheticGlb(validRaw, { width: 0.8, depth: 0.8 });
    await expect(
      shipTripoModel({ input: validRaw, fit: outsideHexFit, kind: "building", out: join(dir, "out5.glb") }),
    ).rejects.toThrow("leaves the unit pointy hex");

    const tooTallRaw = join(dir, "too-tall.glb");
    await writeSyntheticGlb(tooTallRaw, { width: 0.5, depth: 0.5, height: MODEL_BUDGETS.deepGate.maxHeight + 0.2 });
    await expect(
      shipTripoModel({ input: tooTallRaw, fit, kind: "deepGate", out: join(dir, "out6.glb") }),
    ).rejects.toThrow("exceeds height limit");
  });

  it("bakes hex fit, compresses with repo tools and is safe to run twice via CLI", async () => {
    const dir = makeTempDir();
    const input = join(dir, "tripo-raw.glb");
    const fit = join(dir, "fit.json");
    const out = join(dir, "shipped/storeroom.glb");
    const ktx2ColorBytes = await extractKtx2Sample();

    await writeSyntheticGlb(input, {
      triangleCount: 24,
      width: 0.6,
      height: 0.4,
      depth: 0.6,
      baseY: 0.2,
      ktx2ColorBytes,
      nodeTranslation: [0.1, 0.3, -0.1],
      nodeScale: [1, 1, 1],
    });
    writeFileSync(fit, makeFitJson(1.5, [0.15, -0.75, 0.15], 90));

    const runCli = () =>
      JSON.parse(
        execFileSync(process.execPath, [CLI, "--input", input, "--fit", fit, "--kind", "building", "--out", out], {
          encoding: "utf8",
        }),
      );

    const first = runCli();
    const firstBytes = readFileSync(out);
    const second = runCli();
    const secondBytes = readFileSync(out);

    expect(first.triangles).toBe(24);
    expect(first.bounds.min[0]).toBeCloseTo(-0.45, 2);
    expect(first.bounds.max[0]).toBeCloseTo(0.45, 2);
    expect(first.bounds.min[1]).toBeCloseTo(0, 2);
    expect(first.bounds.size[1]).toBeCloseTo(0.6, 2);
    expect(first.bounds.min[2]).toBeCloseTo(-0.45, 2);
    expect(first.bounds.max[2]).toBeCloseTo(0.45, 2);
    expect(second.bounds).toEqual(first.bounds);
    expect(second.sourceSha256).toBe(first.sourceSha256);
    expect(second.fitSha256).toBe(first.fitSha256);
    expect(secondBytes.equals(firstBytes)).toBe(true);

    const io = await createReader();
    const delivered = await io.read(out);
    const root = delivered.getRoot();
    const extensions = root.listExtensionsUsed().map((extension) => extension.extensionName);
    expect(extensions).toEqual(expect.arrayContaining(["KHR_draco_mesh_compression", "KHR_texture_basisu"]));
    for (const node of root.listNodes()) {
      expect(node.getTranslation()).toEqual([0, 0, 0]);
      expect(node.getRotation()).toEqual([0, 0, 0, 1]);
      expect(node.getScale()).toEqual([1, 1, 1]);
    }
    const meshNode = root.listNodes().find((node) => node.getMesh());
    expect(meshNode.getExtras().assetKind).toBe("building");
    expect(meshNode.getExtras().sourceSha256).toBe(first.sourceSha256);
    expect(meshNode.getExtras().fitSha256).toBe(first.fitSha256);
    const deliveredMaterial = root.listMaterials()[0];
    expect(deliveredMaterial.getDoubleSided()).toBe(true);
    expect(deliveredMaterial.getRoughnessFactor()).toBeCloseTo(0.76, 2);
    expect(deliveredMaterial.getMetallicFactor()).toBeCloseTo(0.04, 2);
    expect(deliveredMaterial.getEmissiveFactor()).toEqual([0, 0, 0]);
    expect(deliveredMaterial.getExtras().tripoMaterial).toBe(true);

    const glbJsonLength = secondBytes.readUInt32LE(12);
    const glbJson = JSON.parse(secondBytes.toString("utf8", 20, 20 + glbJsonLength));
    expect(glbJson.images[0].extras?.eternumContentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps every standalone Frontier building model within building budget, grounded, normalized and inside the unit hex", async () => {
    const io = await createReader();
    const paintedPaths = new Set(FRONTIER_PAINTED_BUILDINGS.map((entry) => entry.path));
    const shippedPaths = [
      ...new Set(
        FRONTIER_BUILDING_TYPES.map((type) => frontierPaintedBuildingPath(type)).filter(
          (path) => path && !paintedPaths.has(path),
        ),
      ),
    ];
    expect(shippedPaths.length).toBeGreaterThanOrEqual(3);

    for (const publicPath of shippedPaths) {
      const modelPath = fileURLToPath(new URL(`../../public${publicPath}`, import.meta.url));
      await assertDeliveredAsset(io, modelPath, "building", MODEL_BUDGETS.building);
    }
  });

  it("keeps every shipped Tripo troop model within troop budget, grounded, ownership-clothed and inside the unit hex", async () => {
    const io = await createReader();
    const candidateFiles = [...new Set(Object.values(MODEL_TYPE_TO_FILE))];
    const shippedTroops = [];

    for (const file of candidateFiles) {
      const modelPath = fileURLToPath(new URL(`../../public/models/${file}`, import.meta.url));
      const doc = await io.read(modelPath);
      const meshNode = doc
        .getRoot()
        .listNodes()
        .find((node) => node.getMesh());
      if (meshNode?.getExtras()?.assetKind !== "troop") continue;
      shippedTroops.push({ file, modelPath });
    }

    expect(shippedTroops.length).toBeGreaterThanOrEqual(2);

    for (const { file, modelPath } of shippedTroops) {
      const { root } = await assertDeliveredAsset(io, modelPath, "troop", MODEL_BUDGETS.troop);
      for (const material of root.listMaterials()) {
        expect(material.getExtras().ownershipCloth, file).toBe(true);
      }
    }
  });

  it("keeps every image-to-3D realm model within wonder budget, grounded, normalized and inside the unit hex", async () => {
    const io = await createReader();
    expect(ASPECT_WONDER_PATHS.length).toBe(4);

    for (const publicPath of ASPECT_WONDER_PATHS) {
      const modelPath = fileURLToPath(new URL(`../../public${publicPath}`, import.meta.url));
      await assertDeliveredAsset(io, modelPath, "wonder", MODEL_BUDGETS.wonder);
    }
  });

  it("keeps every Deep building and Deep gate within its budget, grounded, <= 1.42 tall and inside the unit hex", async () => {
    const io = await createReader();
    const entries = [
      ...Object.values(DEEP_SITE_MODELS).map((publicPath) => ({ publicPath, kind: "deepBuilding" })),
      ...Object.values(DEEP_GATE_MODELS).map((publicPath) => ({ publicPath, kind: "deepGate" })),
    ];
    expect(entries.length).toBe(8);

    for (const { publicPath, kind } of entries) {
      const modelPath = fileURLToPath(new URL(`../../public${publicPath}`, import.meta.url));
      await assertDeliveredAsset(io, modelPath, kind, MODEL_BUDGETS[kind]);
    }
  });

  it("keeps one committed source.glb and fit.json pair under asset-sources/tripo for every shipped Tripo delivery", async () => {
    const io = await createReader();
    const paintedPaths = new Set(FRONTIER_PAINTED_BUILDINGS.map((entry) => entry.path));
    const buildingPaths = [
      ...new Set(
        FRONTIER_BUILDING_TYPES.map((type) => frontierPaintedBuildingPath(type)).filter(
          (path) => path && !paintedPaths.has(path),
        ),
      ),
    ];
    const troopPaths = [];
    for (const file of new Set(Object.values(MODEL_TYPE_TO_FILE))) {
      const modelPath = fileURLToPath(new URL(`../../public/models/${file}`, import.meta.url));
      const doc = await io.read(modelPath);
      const meshNode = doc
        .getRoot()
        .listNodes()
        .find((node) => node.getMesh());
      if (meshNode?.getExtras()?.assetKind === "troop") troopPaths.push(`/models/${file}`);
    }
    const expectedStems = [
      ...buildingPaths,
      ...troopPaths,
      ...ASPECT_WONDER_PATHS,
      ...Object.values(DEEP_SITE_MODELS),
      ...Object.values(DEEP_GATE_MODELS),
      ...Object.values(FRONTIER_BEASTS).map((entry) => entry.path),
    ]
      .map((publicPath) => publicPath.replace(/^\/models\//, "").replace(/\.glb$/, ""))
      .sort();

    const committed = readdirSync(new URL("../../asset-sources/tripo", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((file) => file.endsWith("/source.glb") || file.endsWith("/fit.json"))
      .sort();

    expect(committed).toEqual(expectedStems.flatMap((stem) => [`${stem}/fit.json`, `${stem}/source.glb`]).sort());
  });
});
