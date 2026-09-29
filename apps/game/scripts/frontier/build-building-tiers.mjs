/** Procedural tier architecture on the original realm-board buildings. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { draco, prune } from "@gltf-transform/functions";
import dracoCodec from "draco3dgltf";
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";

const sourceDirectory = new URL("../../public/models/new-buildings-opt/", import.meta.url);
const outputDirectory = new URL("../../public/models/frontier/buildings/", import.meta.url);
const families = {
  farm: {
    source: "farm",
    roof: [
      [
        [0.5022, 1.4848, -0.2327],
        [0.6066, 1.2706, -0.2918],
      ],
      [
        [0.4533, 1.4848, -0.2324],
        [0.3482, 1.2706, -0.2903],
      ],
      [
        [0.4912, 1.4848, -0.239],
        [0.4887, 1.2706, -0.3589],
      ],
      [
        [0.4647, 1.4848, -0.1668],
        [0.467, 1.2706, -0.0469],
      ],
      [
        [0.4399, 1.4848, -0.2091],
        [0.3366, 1.2706, -0.2699],
      ],
      [
        [0.5159, 1.4848, -0.1968],
        [0.6192, 1.2706, -0.1359],
      ],
    ],
  },
  barracks: {
    source: "barracks",
    roof: [
      [
        [0.3409, 0.6567, -0.5757],
        [0.3411, 0.6496, 0.0781],
      ],
      [
        [0.705, 0.6496, 0.0781],
        [0.7052, 0.6567, -0.5707],
      ],
      [
        [0.528, 0.842, -0.5445],
        [0.528, 0.837, 0.0498],
      ],
      [
        [0.0694, 0.7794, 0.0674],
        [0.0694, 0.7794, 0.6364],
      ],
      [
        [-0.3746, 0.7794, 0.2613],
        [-0.3746, 0.7794, 0.6364],
      ],
      [
        [-0.152, 0.978, 0.2613],
        [-0.152, 0.978, 0.6066],
      ],
    ],
  },
  storehouse: {
    source: "storehouse",
    roof: [
      [
        [-0.5077, 0.7319, 0.3309],
        [0.2607, 0.7319, 0.6308],
      ],
      [
        [-0.4677, 0.6968, 0.3842],
        [0.1953, 0.6968, 0.6429],
      ],
      [
        [-0.4422, 0.6968, 0.3189],
        [0.2207, 0.6968, 0.5775],
      ],
    ],
  },
  "workers-hut": {
    source: "workers_hut",
    roof: [
      [
        [0.6053, 1.0833, 0.319],
        [0.602, 1.0851, -0.4663],
      ],
      [
        [0.7282, 0.8129, 0.3221],
        [0.7289, 0.813, -0.3849],
      ],
      [
        [-0.264, 1.0847, 0.6139],
        [0.4271, 1.0829, 0.5725],
      ],
      [
        [-0.2058, 0.8129, 0.7444],
        [0.3614, 0.8126, 0.7401],
      ],
      [
        [0.4762, 1.0942, -0.5733],
        [0.3348, 0.8107, -0.4893],
      ],
      [
        [0.621, 1.0942, -0.5733],
        [0.7625, 0.8107, -0.4893],
      ],
    ],
  },
};
const requestedFamily = process.argv[2];
if (requestedFamily && !families[requestedFamily]) throw new Error(`Unknown building family: ${requestedFamily}`);
await buildTiers();

async function buildTiers() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await dracoCodec.createDecoderModule(),
    "draco3d.encoder": await dracoCodec.createEncoderModule(),
  });
  const glowMask = await buildGlowMask();
  await mkdir(outputDirectory, { recursive: true });
  for (const [name, family] of Object.entries(families)) {
    if (requestedFamily && name !== requestedFamily) continue;
    for (const tier of [2, 3]) {
      const document = await io.read(fileURLToPath(new URL(`${family.source}.glb`, sourceDirectory)));
      const parts = buildArchitecture(name, family, tier);
      mergeIntoBuilding(document, name, parts, tier, glowMask);
      await document.transform(prune(), draco({ method: "edgebreaker" }));
      await io.write(fileURLToPath(new URL(`${name}-${tier}.glb`, outputDirectory)), document);
      console.log(`${name}-${tier}.glb`);
    }
  }
}

function buildArchitecture(name, family, tier) {
  const parts = [];
  const trim = { color: [null, "#837a68", "#e3e9ef", "#dfaa54"][tier], surface: "plain", glow: tier === 3 };
  addHexFacing(parts, trim);
  if (tier > 1) {
    addExtension(parts, name, tier);
    for (const [start, end] of family.roof) {
      add(parts, beam(new Vector3(...start), new Vector3(...end), tier === 3 ? 0.048 : 0.038), trim);
    }
  }
  addRoofBanner(parts, name, tier, trim);
  verifyAddedFootprint(parts);
  return parts;
}

function verifyAddedFootprint(parts) {
  for (const { geometry } of parts) {
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      const x = Math.abs(positions.getX(index)),
        z = Math.abs(positions.getZ(index));
      if (x > Math.sqrt(3) / 2 || x + Math.sqrt(3) * z > Math.sqrt(3)) {
        throw new Error("Tier fitting crosses the unit-radius hex");
      }
    }
  }
}

function addHexFacing(parts, style) {
  for (let side = 0; side < 6; side++) {
    const start = hexPoint(side, 0.92, 0.067);
    const end = hexPoint(side + 1, 0.92, 0.067);
    add(parts, beam(start.clone().lerp(end, 0.025), end.clone().lerp(start, 0.025), 0.068), style);
  }
}

function addExtension(parts, name, tier) {
  if (name === "farm") {
    addGabledRoom(parts, [-0.37, 0.1, 0.39], [0.43, 0.46, 0.4], tier === 2);
    if (tier === 3) addGabledRoom(parts, [-0.37, 0.56, 0.39], [0.36, 0.43, 0.34]);
  } else if (name === "barracks") {
    addWatchtower(parts, [-0.49, 0.12, -0.3], 1.15);
    if (tier === 3) addWatchtower(parts, [0.53, 0.65, -0.28], 1.48);
  } else if (name === "storehouse") {
    addGabledRoom(parts, [-0.44, 0.1, -0.39], [0.38, 0.47, 0.39]);
    if (tier === 3) addGabledRoom(parts, [-0.18, 0.69, 0.44], [0.36, 0.42, 0.34]);
  } else if (name === "workers-hut") {
    addPorch(parts);
    if (tier === 3) {
      addBox(parts, [-0.14, 1.22, 0.54], [0.19, 0.7, 0.2], { surface: "stone" });
      addBox(parts, [-0.14, 1.57, 0.54], [0.24, 0.055, 0.25], { surface: "stone" });
      addBox(parts, [-0.14, 1.6, 0.54], [0.13, 0.015, 0.14], { color: "#1b1207" });
    }
  }
}

function addGabledRoom(parts, [x, base, z], [width, height, depth], includeRoof = true) {
  addBox(parts, [x, base + height / 2, z], [width, height, depth], { surface: "stone" });
  for (const dx of [-width / 2, width / 2]) {
    for (const dz of [-depth / 2, depth / 2])
      addBox(parts, [x + dx, base + height / 2, z + dz], [0.035, height, 0.035], { surface: "wood" });
  }
  for (const dz of [-depth / 2, depth / 2])
    addBox(parts, [x, base + height - 0.018, z + dz], [width, 0.037, 0.035], { surface: "wood" });
  for (const dx of [-width / 2, width / 2])
    addBox(parts, [x + dx, base + height - 0.018, z], [0.035, 0.037, depth], { surface: "wood" });
  if (includeRoof)
    add(parts, gable(width + 0.07, 0.2, depth + 0.06).translate(x, base + height, z), { surface: "roof" });
  addBox(parts, [x, base + height * 0.38, z - depth / 2 - 0.005], [width * 0.35, height * 0.65, 0.016], {
    surface: "wood",
  });
  addBox(parts, [x, base + height * 0.38, z + depth / 2 + 0.005], [width * 0.35, height * 0.65, 0.016], {
    surface: "wood",
  });
}

function addWatchtower(parts, [x, base, z], top) {
  addBox(parts, [x, (base + top) / 2, z], [0.32, top - base, 0.32], { surface: "stone" });
  addBox(parts, [x, top, z], [0.41, 0.065, 0.41], { surface: "stone" });
  for (const dx of [-0.15, 0.15]) {
    for (const dz of [-0.15, 0.15])
      addBox(parts, [x + dx, top + 0.09, z + dz], [0.11, 0.15, 0.11], { surface: "stone" });
  }
  for (const dz of [-0.165, 0.165]) addBox(parts, [x, top - 0.2, z + dz], [0.065, 0.15, 0.012], { color: "#1b1207" });
}

function addPorch(parts) {
  for (const x of [-0.47, -0.06]) {
    for (const z of [-0.43, -0.1]) addBox(parts, [x, 0.31, z], [0.055, 0.44, 0.055], { surface: "wood" });
  }
  add(parts, gable(0.53, 0.18, 0.46).translate(-0.265, 0.53, -0.265), { surface: "roof" });
  addBox(parts, [-0.265, 0.12, -0.265], [0.48, 0.075, 0.41], { surface: "stone" });
}

function addRoofBanner(parts, name, tier, trim) {
  const anchors = {
    farm: [0.478, 1.52, -0.203],
    barracks: [-0.15, 1.0, 0.43],
    storehouse: [-0.15, 0.78, 0.48],
    "workers-hut": [0.49, 1.1, -0.25],
  };
  if (name === "storehouse" && tier === 3) anchors[name] = [-0.18, 1.32, 0.44];
  const [x, y, z] = anchors[name];
  const width = 0.32 + tier * 0.015;
  addBox(parts, [x, y + 0.2, z], [0.023, 0.44, 0.023], { surface: "wood" });
  addBox(parts, [x + width / 2, y + 0.3, z], [width, 0.21, 0.018], { ...trim, glow: false });
  for (const direction of [-1, 1]) {
    for (let index = 0; index < tier; index++) {
      addBox(
        parts,
        [x + width / 2 + (index - (tier - 1) / 2) * 0.065, y + 0.3, z + direction * 0.013],
        [0.022, 0.12, 0.012],
        { color: "#1b1207" },
      );
    }
  }
}

function addBox(parts, center, size, style) {
  add(parts, new BoxGeometry(...size).translate(...center), style);
}

function add(parts, geometry, style) {
  parts.push({
    geometry,
    surface: style.surface ?? "plain",
    color: style.color ?? "#ffffff",
    glow: style.glow ?? false,
  });
}

function gable(width, height, depth) {
  const vertices = [
    -width / 2,
    0,
    -depth / 2,
    width / 2,
    0,
    -depth / 2,
    0,
    height,
    -depth / 2,
    -width / 2,
    0,
    depth / 2,
    width / 2,
    0,
    depth / 2,
    0,
    height,
    depth / 2,
  ];
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
  const flat = geometry.toNonIndexed();
  const uv = [];
  flat.computeVertexNormals();
  for (let index = 0; index < flat.attributes.position.count; index++) {
    const front = Math.abs(flat.attributes.normal.getZ(index)) > 0.5;
    uv.push(
      front ? flat.attributes.position.getX(index) / width + 0.5 : flat.attributes.position.getZ(index) / depth + 0.5,
      flat.attributes.position.getY(index) / height,
    );
  }
  flat.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  flat.computeVertexNormals();
  geometry.dispose();
  return flat;
}

function hexPoint(index, radius, height) {
  const angle = (index * Math.PI) / 3;
  return new Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

function beam(start, end, width) {
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  return new BoxGeometry(width, direction.length(), width).applyMatrix4(
    new Matrix4().compose(start.clone().add(end).multiplyScalar(0.5), rotation, new Vector3(1, 1, 1)),
  );
}

function mergeIntoBuilding(document, family, parts, tier, glowMask) {
  const root = document.getRoot();
  const node = root
    .listNodes()
    .find((item) => item.getName() === (family === "farm" ? "grass.001" : family.replace("-", "_")));
  const primitive = node
    .getMesh()
    .listPrimitives()
    .find((item) => item.getMaterial().getName() === (family === "farm" ? "building" : family.replace("-", ".")));
  const material = primitive.getMaterial();
  const sourceCount = primitive.getAttribute("POSITION").getCount();
  const arrays = readPrimitive(primitive);
  const inverse = new Matrix4().fromArray(node.getWorldMatrix()).invert();
  for (const part of parts) appendPart(arrays, part, inverse);
  writePrimitive(document, primitive, arrays);
  node.setExtras({ ...node.getExtras(), tierSourceVertices: sourceCount, frontierTier: tier });
  if (tier === 3) addTrimEmission(document, material, glowMask);
}

function readPrimitive(primitive) {
  const attributes = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2, COLOR_0: 4, TEXCOORD_1: 2 };
  const arrays = { indices: Array.from(primitive.getIndices().getArray()) };
  const count = primitive.getAttribute("POSITION").getCount();
  for (const [name, width] of Object.entries(attributes)) {
    const accessor = primitive.getAttribute(name);
    arrays[name] = [];
    for (let index = 0; index < count; index++)
      arrays[name].push(...(accessor ? accessor.getElement(index, []) : Array(width).fill(name === "COLOR_0" ? 1 : 0)));
  }
  return arrays;
}

function appendPart(arrays, part, inverse) {
  const geometry = part.geometry.applyMatrix4(inverse);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const color = new Color(part.color).toArray();
  const offset = arrays.POSITION.length / 3;
  const regions = {
    stone: [0.035, 0.04, 0.39, 0.28],
    roof: [0.035, 0.41, 0.36, 0.34],
    wood: [0.61, 0.035, 0.33, 0.28],
    plain: [0.22, 0.94, 0, 0],
  };
  const [u, v, width, height] = regions[part.surface];
  for (let index = 0; index < position.count; index++) {
    arrays.POSITION.push(position.getX(index), position.getY(index), position.getZ(index));
    arrays.NORMAL.push(normal.getX(index), normal.getY(index), normal.getZ(index));
    arrays.TEXCOORD_0.push(u + uv.getX(index) * width, v + uv.getY(index) * height);
    arrays.COLOR_0.push(...color, 1);
    arrays.TEXCOORD_1.push(part.glow ? 0.54 + uv.getX(index) * 0.4 : 0.25, 0.5);
  }
  const indices = geometry.index?.array ?? Array.from({ length: position.count }, (_, index) => index);
  for (const index of indices) arrays.indices.push(index + offset);
  geometry.dispose();
}

function writePrimitive(document, primitive, arrays) {
  const buffer = document.getRoot().listBuffers()[0];
  for (const [name, values] of Object.entries(arrays)) {
    const width = name.startsWith("TEXCOORD") ? 2 : name === "COLOR_0" ? 4 : 3;
    const accessor = document.createAccessor(name).setBuffer(buffer);
    if (name === "indices") primitive.setIndices(accessor.setType("SCALAR").setArray(new Uint32Array(values)));
    else primitive.setAttribute(name, accessor.setType(`VEC${width}`).setArray(new Float32Array(values)));
  }
}

function addTrimEmission(document, material, mask) {
  const texture = document
    .createTexture("Tier trim emission mask")
    .setImage(mask)
    .setMimeType("image/ktx2")
    .setExtras({ eternumContentHash: createHash("sha256").update(mask).digest("hex") });
  material.setEmissiveTexture(texture).setEmissiveFactor(new Color("#dfaa54").toArray());
  material.getEmissiveTextureInfo().setTexCoord(1).setWrapS(33071).setWrapT(33071);
  const extension = document.createExtension(KHRMaterialsEmissiveStrength);
  material.setExtension("KHR_materials_emissive_strength", extension.createEmissiveStrength().setEmissiveStrength(1.6));
  // The Farm shares this material with moving parts. Their second UV set stays on black.
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMaterial() !== material || primitive.getAttribute("TEXCOORD_1")) continue;
      const count = primitive.getAttribute("POSITION").getCount();
      primitive.setAttribute(
        "TEXCOORD_1",
        document
          .createAccessor("Unlit source parts")
          .setType("VEC2")
          .setArray(new Float32Array(count * 2))
          .setBuffer(document.getRoot().listBuffers()[0]),
      );
    }
  }
}

async function buildGlowMask() {
  const directory = await mkdtemp(join(tmpdir(), "frontier-tier-mask-"));
  try {
    const pixels = Buffer.alloc(16 * 4 * 4);
    const levels = [0, 20, 80, 180, 180, 80, 20, 0];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        const offset = (y * 16 + x) * 4;
        pixels.fill(x < 8 ? 0 : levels[x - 8], offset, offset + 3);
        pixels[offset + 3] = 255;
      }
    }
    await writeFile(join(directory, "mask.rgba"), pixels);
    execFileSync("ktx", [
      "create",
      "--raw",
      "--width",
      "16",
      "--height",
      "4",
      "--format",
      "R8G8B8A8_SRGB",
      "--encode",
      "basis-lz",
      join(directory, "mask.rgba"),
      join(directory, "mask.ktx2"),
    ]);
    return await readFile(join(directory, "mask.ktx2"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
