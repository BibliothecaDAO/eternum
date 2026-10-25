import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { expect, it } from "vitest";
import catalogue from "../../src/three/structures/frontier-painted-buildings.json";

const DELIVERIES = new URL("../../public/models/frontier/painted/", import.meta.url);
const SOURCES = new URL("../../asset-sources/frontier-painted/", import.meta.url);
// The shipped realm-board buildings and realm castles are 226 to 565 KB; no delivery of the set passes 600 KB.
const MAX_BYTES = 600_000;
const MAX_DRAWS = 5;
const APOTHEM = Math.sqrt(3) / 2;
const TIERED_GROUPS = new Set(["farm", "workshop", "barracks", "workers-hut"]);

it("keeps one delivery and one editable source per catalogued building", () => {
  const ids = catalogue.map((building) => `${building.id}.glb`).sort();
  expect(
    readdirSync(DELIVERIES)
      .filter((file) => file.endsWith(".glb"))
      .sort(),
  ).toEqual(ids);
  expect(
    readdirSync(SOURCES)
      .filter((file) => file.endsWith(".glb"))
      .sort(),
  ).toEqual(ids);
  for (const building of catalogue) expect(building.path).toBe(`/models/frontier/painted/${building.id}.glb`);
});

for (const building of catalogue) {
  it(`${building.id}: compressed, inside its hex and grounded, with the parts the runtime drives`, async () => {
    const path = new URL(`${building.id}.glb`, DELIVERIES);
    const bytes = readFileSync(path);
    expect(bytes.length).toBeLessThanOrEqual(MAX_BYTES);
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
    const root = (await io.read(path.pathname)).getRoot();
    const used = root.listExtensionsUsed().map((extension) => extension.extensionName);
    expect(used).toEqual(expect.arrayContaining(["KHR_draco_mesh_compression", "KHR_texture_basisu"]));
    for (const texture of root.listTextures()) expect(texture.getMimeType()).toBe("image/ktx2");

    const parts = new Map(root.listNodes().map((node) => [node.getExtras().frontierPart, node]));
    const architecture = parts.get("architecture");
    expect(architecture.getExtras().frontierBuilding).toBe(building.id);
    expect(architecture.getExtras().sourceSha256).toBe(sha256(new URL(`${building.id}.glb`, SOURCES)));
    expect(triangles(architecture)).toBeLessThanOrEqual(building.architectureTriangles);
    const material = architecture.getMesh().listPrimitives()[0].getMaterial();
    expect(material.getBaseColorTexture()).not.toBeNull();
    expect(material.getNormalTexture()).not.toBeNull();
    for (const atlas of [material.getBaseColorTexture(), material.getEmissiveTexture()].filter(Boolean)) {
      expect(ktx2Size(atlas)).toEqual([building.atlasSize, building.atlasSize]);
    }

    const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
    expect(primitives.length).toBeLessThanOrEqual(MAX_DRAWS);
    for (const primitive of primitives) expect(primitive.getMaterial().getDoubleSided()).toBe(true);
    // The world map's instancing draws each part's geometry without its node transform: every transform is baked.
    for (const node of root.listNodes()) {
      expect(node.getTranslation()).toEqual([0, 0, 0]);
      expect(node.getRotation()).toEqual([0, 0, 0, 1]);
      expect(node.getScale()).toEqual([1, 1, 1]);
    }
    expectInsideGroundedHex(root.listNodes());
    expectRuntimeParts(building, parts, root.listAnimations());
  });
}

/** Every vertex, at rest and in every morph pose (a turning rotor's steps), stays on the tile and above the ground. */
function expectInsideGroundedHex(nodes) {
  let minY = Infinity;
  for (const primitive of nodes.flatMap((node) => node.getMesh()?.listPrimitives() ?? [])) {
    const positions = primitive.getAttribute("POSITION");
    const poses = [null, ...primitive.listTargets().map((target) => target.getAttribute("POSITION"))];
    for (const offsets of poses) {
      for (let index = 0; index < positions.getCount(); index++) {
        const [x, y, z] = positions.getElement(index, []);
        const [dx, dy, dz] = offsets ? offsets.getElement(index, []) : [0, 0, 0];
        expect(insideHex(x + dx, z + dz)).toBe(true);
        minY = Math.min(minY, y + dy);
      }
    }
  }
  expect(minY).toBeGreaterThanOrEqual(-0.05);
  expect(minY).toBeLessThan(0.02);
}

function expectRuntimeParts(building, parts, animations) {
  const isRealm = building.group === "realms";
  const isTiered = TIERED_GROUPS.has(building.group);
  expect(parts.has("ground")).toBe(building.group !== "sites");
  expect(parts.has("tier-banner")).toBe(isTiered);
  if (isTiered) expectHeldBanner(parts.get("tier-banner"));
  expect(parts.has("order-cloth")).toBe(isRealm);
  if (isRealm) expectOrderCloth(parts.get("order-cloth"));
  const isMill = building.group === "farm";
  const isRift = building.id === "essence-rift";
  expect(parts.has("rotor")).toBe(isMill);
  expect(animations.map((animation) => animation.getName())).toEqual(isMill ? ["rotor"] : isRift ? ["rift-surge"] : []);
  if (isRift) expectRiftSurge(parts.get("architecture"), animations[0]);
  if (isMill) {
    // The world map's instancing animates morph weights only; the rotor turns through its morph targets.
    const rotor = parts.get("rotor");
    expect(rotor.getMesh().listPrimitives()[0].listTargets().length).toBeGreaterThan(1);
    const channels = animations[0].listChannels();
    expect(channels.map((channel) => [channel.getTargetNode(), channel.getTargetPath()])).toEqual([[rotor, "weights"]]);
    expectConstantTurn(channels[0].getSampler());
  }
}

function expectRiftSurge(architecture, animation) {
  const channels = animation.listChannels();
  expect(channels.map((channel) => [channel.getTargetNode(), channel.getTargetPath()])).toEqual([
    [architecture, "weights"],
  ]);
  const sampler = channels[0].getSampler();
  expect(sampler.getInterpolation()).toBe("LINEAR");
  const primitive = architecture.getMesh().listPrimitives()[0];
  const positions = primitive.getAttribute("POSITION");
  const targets = primitive.listTargets();
  expect(targets.length).toBeGreaterThan(1);
  const weights = Array.from(sampler.getOutput().getArray());
  expect(weights.slice(0, targets.length)).toEqual(weights.slice(-targets.length));
  expect(weights.some((weight) => weight > 0.9)).toBe(true);
  let maxSurge = 0;
  let moving = 0;
  for (let index = 0; index < positions.getCount(); index++) {
    const [x, y, z] = positions.getElement(index, []);
    const offsets = targets.map((target) => target.getAttribute("POSITION").getElement(index, []));
    const travel = Math.max(...offsets.map(([dx, dy, dz]) => Math.hypot(dx, dy, dz)));
    if (y < 0.034 || Math.hypot(x, z) > 0.751) expect(travel).toBeLessThan(0.001);
    if (travel > 0.01) moving++;
    maxSurge = Math.max(maxSurge, travel);
  }
  expect(maxSurge).toBeGreaterThan(0.06);
  expect(moving).toBeGreaterThan(30);
  expect(moving).toBeLessThan(positions.getCount() / 2);
}

/** The sails turn at one speed through the loop: their progress through the steps grows in proportion to time. */
function expectConstantTurn(sampler) {
  expect(sampler.getInterpolation()).toBe("LINEAR");
  const times = sampler.getInput().getArray();
  const weights = sampler.getOutput().getArray();
  const steps = weights.length / times.length;
  const span = times[times.length - 1] - times[0];
  for (let key = 0; key < times.length; key++) {
    let progress = 0;
    for (let target = 0; target < steps; target++) progress += (target + 1) * weights[key * steps + target];
    expect(progress).toBeCloseTo((steps * (times[key] - times[0])) / span, 2);
  }
}

/**
 * A tier banner holds its world heading while the board turns its building (src/three/structures/held-heading.ts):
 * it names its pole, and swung about that pole to any of the board's six headings it stays on the tile.
 */
function expectHeldBanner(node) {
  const [px, pz] = node.getExtras().poleAxis;
  expect(insideHex(px, pz)).toBe(true);
  for (const primitive of node.getMesh().listPrimitives()) {
    const positions = primitive.getAttribute("POSITION");
    for (let step = 0; step < 6; step++) {
      const [cos, sin] = [Math.cos((step * Math.PI) / 3), Math.sin((step * Math.PI) / 3)];
      for (let index = 0; index < positions.getCount(); index++) {
        const [x, , z] = positions.getElement(index, []);
        const [dx, dz] = [x - px, z - pz];
        expect(insideHex(px + dx * cos - dz * sin, pz + dx * sin + dz * cos)).toBe(true);
      }
    }
  }
}

function insideHex(x, z) {
  return [0, 1, 2, 3, 4, 5].every(
    (side) => x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3) <= APOTHEM,
  );
}

/** Ownership cloth the realm's appearance paints with the order's banner; every flag samples inside the canvas. */
function expectOrderCloth(node) {
  expect(node.getExtras().orderCloth).toBe("banner");
  expectClothUvs(node);
}

function expectClothUvs(node) {
  for (const primitive of node.getMesh().listPrimitives()) {
    const uvs = primitive.getAttribute("TEXCOORD_0");
    for (let index = 0; index < uvs.getCount(); index++) {
      const [u, v] = uvs.getElement(index, []);
      expect(u).toBeGreaterThanOrEqual(-0.001);
      expect(u).toBeLessThanOrEqual(1.001);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  }
}

function triangles(node) {
  return node
    .getMesh()
    .listPrimitives()
    .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
}

/** Width and height from a KTX2 header: glTF Transform reads no KTX2 dimensions. */
function ktx2Size(texture) {
  const image = texture.getImage();
  const header = new DataView(image.buffer, image.byteOffset, image.byteLength);
  return [header.getUint32(20, true), header.getUint32(24, true)];
}

function sha256(url) {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}
