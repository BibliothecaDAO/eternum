import brandPalette from "@/brand/palette.json";
import { aspects, catalogOrder, orders, type AspectId } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  type Matrix4,
  SRGBColorSpace,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  attribute,
  float,
  instanceIndex,
  positionLocal,
  select,
  texture as tslTexture,
  uv,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";
import { mapAnimationTime as time } from "../effects/endgame/state";
import { createInstancedMesh, createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";
import { loadOrderArtwork } from "./settlement-appearance";

type SignumOffset = { readonly x: number; readonly y: number; readonly z: number };

const SIGNUM_OFFSET: SignumOffset = { x: 0.58, y: 0, z: 0.42 };
const ZERO_OFFSET: SignumOffset = { x: 0, y: 0, z: 0 };
const POLE_HEIGHT = 0.62;
const CROSSBAR_Y = 0.41;
const PLAQUE_Y = 0.66;
const PLAQUE_RADIUS = 0.21;
const PLAQUE_DEPTH = 0.044;
const EMBLEM_RADIUS = 0.182;
const FINIAL_BASE_Y = PLAQUE_Y + PLAQUE_RADIUS + 0.01;
const CLOTH_TOP_Y = CROSSBAR_Y - 0.015;
const CLOTH_LENGTH = 0.28;

const IRON_HEX = "#2d2a30";
const BRONZE_HEX = "#8a6536";
const SLATE_HEX = "#1d1a22";
const GOLD_HEX = brandPalette.brand["mark-gold"];
const SILVER_HEX = "#cfd5de";

const ATLAS_SIZE = 1024;
const ATLAS_COLUMNS = 5;
const ATLAS_ROWS = 4;
const CELL_WIDTH = Math.floor(ATLAS_SIZE / ATLAS_COLUMNS);
const CELL_HEIGHT = Math.floor(ATLAS_SIZE / ATLAS_ROWS);
const BLANK_CELL = orders.length;
const ORDER_CELLS = new Map(orders.map((order, index) => [order.orderId, index]));

const NEUTRAL_CLOTH = new Color(SLATE_HEX);

type SharedSignumAtlas = {
  texture: CanvasTexture;
  refs: number;
  preparation?: Promise<void>;
};

let sharedSignumAtlas: SharedSignumAtlas | null = null;

function acquireSignumAtlas(): SharedSignumAtlas {
  if (!sharedSignumAtlas) {
    sharedSignumAtlas = { texture: createSignumAtlas(), refs: 0 };
  }
  sharedSignumAtlas.refs += 1;
  return sharedSignumAtlas;
}

function prepareSignumAtlas(entry: SharedSignumAtlas): Promise<void> {
  return (entry.preparation ??= loadOrderArtwork().then((images) => {
    if (sharedSignumAtlas !== entry) return;
    paintSignumAtlas(entry.texture, images);
  }));
}

function releaseSignumAtlas(entry: SharedSignumAtlas): void {
  entry.refs -= 1;
  if (entry.refs <= 0 && sharedSignumAtlas === entry) {
    entry.texture.dispose();
    sharedSignumAtlas = null;
  }
}

export const ORDER_STANDARD_NAME = "Order stone signum";

export class OrderStandard {
  readonly group = new Group();
  readonly body: InstancedMesh;
  readonly cloth: InstancedMesh;
  readonly emblem: InstancedMesh;
  private readonly placement: InstancedMesh;
  private readonly aspectAttr: InstancedBufferAttribute;
  private readonly clothColorAttr: InstancedBufferAttribute;
  private readonly orderCellAttr: InstancedBufferAttribute;
  private readonly sharedAtlas: SharedSignumAtlas;
  private disposed = false;

  constructor(
    placement: InstancedMesh | number,
    offset: SignumOffset = typeof placement === "number" ? ZERO_OFFSET : SIGNUM_OFFSET,
  ) {
    this.group.name = ORDER_STANDARD_NAME;
    const slots = typeof placement === "number" ? placement : placement.instanceMatrix.count;
    this.aspectAttr = new InstancedBufferAttribute(new Float32Array(slots), 1);
    this.clothColorAttr = new InstancedBufferAttribute(new Float32Array(slots * 3), 3);
    this.orderCellAttr = new InstancedBufferAttribute(new Float32Array(slots).fill(BLANK_CELL), 1);
    for (let index = 0; index < slots; index++) {
      this.clothColorAttr.setXYZ(index, NEUTRAL_CLOTH.r, NEUTRAL_CLOTH.g, NEUTRAL_CLOTH.b);
    }

    const bodyGeometry = signumBodyGeometry(offset);
    bodyGeometry.setAttribute("signumAspect", this.aspectAttr);
    if (typeof placement === "number") {
      this.body = createInstancedMesh(bodyGeometry, signumBodyMaterial(), slots);
      this.body.count = 0;
      this.placement = this.body;
    } else {
      this.placement = placement;
      this.body = createInstancedMeshWithSharedMatrices(bodyGeometry, signumBodyMaterial(), placement);
    }
    this.body.name = "Order signum stone";
    this.body.castShadow = false;
    this.body.receiveShadow = true;
    this.body.frustumCulled = false;
    this.body.raycast = () => {};

    const clothGeometry = signumClothGeometry(offset);
    clothGeometry.setAttribute("signumClothColor", this.clothColorAttr);
    this.cloth = createInstancedMeshWithSharedMatrices(clothGeometry, signumClothMaterial(), this.placement);
    this.cloth.name = "Order signum cloth";
    this.cloth.castShadow = false;
    this.cloth.receiveShadow = true;
    this.cloth.frustumCulled = false;
    this.cloth.raycast = () => {};

    this.sharedAtlas = acquireSignumAtlas();
    const emblemGeometry = signumEmblemGeometry(offset);
    emblemGeometry.setAttribute("signumOrderCell", this.orderCellAttr);
    this.emblem = createInstancedMeshWithSharedMatrices(
      emblemGeometry,
      signumEmblemMaterial(this.sharedAtlas.texture),
      this.placement,
    );
    this.emblem.name = "Order signum emblem";
    this.emblem.castShadow = false;
    this.emblem.receiveShadow = false;
    this.emblem.frustumCulled = false;
    this.emblem.raycast = () => {};

    this.group.add(this.body, this.cloth, this.emblem);
    this.syncCount();
  }

  static standalone(capacity: number): OrderStandard {
    return new OrderStandard(capacity, ZERO_OFFSET);
  }

  setMatrixAt(index: number, matrix: Matrix4): void {
    this.placement.setMatrixAt(index, matrix);
  }

  setCount(count: number): void {
    this.placement.count = count;
    this.syncCount();
  }

  needsUpdate(): void {
    this.placement.instanceMatrix.needsUpdate = true;
  }

  prepare(): Promise<void> {
    return prepareSignumAtlas(this.sharedAtlas);
  }

  setOrderAt(index: number, orderId: number | undefined): void {
    if (orderId === undefined) {
      this.aspectAttr.setX(index, 0);
      this.clothColorAttr.setXYZ(index, NEUTRAL_CLOTH.r, NEUTRAL_CLOTH.g, NEUTRAL_CLOTH.b);
      this.orderCellAttr.setX(index, BLANK_CELL);
    } else {
      const order = catalogOrder(orderId);
      const cell = ORDER_CELLS.get(order.orderId);
      if (cell === undefined) throw new Error(`Unknown realm order: ${orderId}`);
      const tint = new Color(order.color);
      this.aspectAttr.setX(index, order.aspect ?? 0);
      this.clothColorAttr.setXYZ(index, tint.r, tint.g, tint.b);
      this.orderCellAttr.setX(index, cell);
    }
    this.aspectAttr.needsUpdate = true;
    this.clothColorAttr.needsUpdate = true;
    this.orderCellAttr.needsUpdate = true;
  }

  syncCount(): void {
    const count = this.placement.count;
    this.body.count = count;
    this.cloth.count = count;
    this.emblem.count = count;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of [this.body, this.cloth, this.emblem]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as MeshStandardNodeMaterial | MeshBasicNodeMaterial).dispose();
      mesh.dispose();
    }
    releaseSignumAtlas(this.sharedAtlas);
    this.group.removeFromParent();
  }
}

export function resolveOrderSignumCell(orderId: number | undefined): number {
  if (orderId === undefined) return BLANK_CELL;
  const cell = ORDER_CELLS.get(orderId);
  if (cell === undefined) throw new Error(`Unknown realm order: ${orderId}`);
  return cell;
}

function paintGeometry(geometry: BufferGeometry, hex: string, finialAspect: number): BufferGeometry {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  if (geometry.index) geometry.dispose();
  const count = nonIndexed.getAttribute("position").count;
  const tint = new Color(hex);
  const colors = new Float32Array(count * 3);
  const aspects = new Float32Array(count).fill(finialAspect);
  for (let index = 0; index < count; index++) {
    colors[index * 3] = tint.r;
    colors[index * 3 + 1] = tint.g;
    colors[index * 3 + 2] = tint.b;
  }
  nonIndexed.setAttribute("color", new Float32BufferAttribute(colors, 3));
  nonIndexed.setAttribute("finialAspect", new Float32BufferAttribute(aspects, 1));
  if (!nonIndexed.getAttribute("normal")) nonIndexed.computeVertexNormals();
  nonIndexed.deleteAttribute("uv");
  return nonIndexed;
}

function signumBodyGeometry(offset: SignumOffset): BufferGeometry {
  const parts: BufferGeometry[] = [
    paintGeometry(new CylinderGeometry(0.055, 0.072, 0.05, 6).translate(0, 0.025, 0), IRON_HEX, 0),
    paintGeometry(new CylinderGeometry(0.02, 0.028, POLE_HEIGHT, 6).translate(0, POLE_HEIGHT / 2, 0), IRON_HEX, 0),
    paintGeometry(new BoxGeometry(0.32, 0.028, 0.032).translate(0, CROSSBAR_Y, 0), BRONZE_HEX, 0),
    paintGeometry(new BoxGeometry(0.036, 0.044, 0.044).translate(-0.165, CROSSBAR_Y, 0), GOLD_HEX, 0),
    paintGeometry(new BoxGeometry(0.036, 0.044, 0.044).translate(0.165, CROSSBAR_Y, 0), GOLD_HEX, 0),
    paintGeometry(
      new CylinderGeometry(PLAQUE_RADIUS, PLAQUE_RADIUS, PLAQUE_DEPTH, 6)
        .rotateX(Math.PI / 2)
        .translate(0, PLAQUE_Y, 0),
      SLATE_HEX,
      0,
    ),
    ...hexRimParts(),
    ...aspects.flatMap(({ id }) => ASPECT_FINIALS[id](id)),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("Order signum geometry did not merge");
  merged.translate(offset.x, offset.y, offset.z);
  return merged;
}

function hexRimParts(): BufferGeometry[] {
  const rimRadius = PLAQUE_RADIUS * 0.96;
  const edgeLength = PLAQUE_RADIUS * 1.06;
  return Array.from({ length: 6 }, (_, side) => {
    const angle = (side * Math.PI) / 3 + Math.PI / 6;
    const midX = Math.cos(angle) * rimRadius * 0.87;
    const midY = Math.sin(angle) * rimRadius * 0.87;
    return paintGeometry(
      new BoxGeometry(edgeLength, 0.026, PLAQUE_DEPTH + 0.012)
        .rotateZ(angle + Math.PI / 2)
        .translate(midX, PLAQUE_Y + midY, 0),
      GOLD_HEX,
      0,
    );
  });
}

const ASPECT_FINIALS = {
  1: (aspect) => [
    paintGeometry(new BoxGeometry(0.12, 0.022, 0.028).translate(0, FINIAL_BASE_Y + 0.02, 0), GOLD_HEX, aspect),
    paintGeometry(
      new ConeGeometry(0.044, 0.16, 4).rotateY(Math.PI / 4).translate(0, FINIAL_BASE_Y + 0.11, 0),
      GOLD_HEX,
      aspect,
    ),
  ],
  2: (aspect) => [
    paintGeometry(
      new CylinderGeometry(0.036, 0.028, 0.03, 8).translate(0, FINIAL_BASE_Y + 0.015, 0),
      SILVER_HEX,
      aspect,
    ),
    paintGeometry(new IcosahedronGeometry(0.06, 1).translate(0, FINIAL_BASE_Y + 0.09, 0), SILVER_HEX, aspect),
  ],
  3: (aspect) => [
    paintGeometry(
      new ConeGeometry(0.03, 0.14, 4).translate(0, 0.07, 0).rotateZ(0.36).translate(-0.024, FINIAL_BASE_Y, 0),
      IRON_HEX,
      aspect,
    ),
    paintGeometry(
      new ConeGeometry(0.034, 0.18, 4).translate(0, 0.09, 0).rotateZ(-0.42).translate(0.026, FINIAL_BASE_Y, 0),
      GOLD_HEX,
      aspect,
    ),
  ],
  4: (aspect) => [
    paintGeometry(new TorusGeometry(0.06, 0.014, 6, 12).translate(0, FINIAL_BASE_Y + 0.08, 0), SILVER_HEX, aspect),
    paintGeometry(new CylinderGeometry(0.009, 0.009, 0.19, 5).translate(0, FINIAL_BASE_Y + 0.095, 0), GOLD_HEX, aspect),
  ],
} as const satisfies Record<AspectId, (aspect: AspectId) => BufferGeometry[]>;

function signumBodyMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.18 });
  const finial = attribute<"float">("finialAspect", "float");
  const active = attribute<"float">("signumAspect", "float");
  const keep = finial.lessThan(0.5).or(finial.sub(active).abs().lessThan(0.5));
  material.positionNode = select(keep, positionLocal, vec3(0, 0, 0));
  material.name = "order-signum-body";
  return material;
}

function signumClothGeometry(offset: SignumOffset): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 4;
  const width = 0.088;
  for (const centerX of [-0.088, 0.088]) {
    const start = positions.length / 3;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      const y = CLOTH_TOP_Y - t * CLOTH_LENGTH;
      const half = (width / 2) * (1 - t * 0.12);
      const notch = row === segments ? 0.032 : 0;
      positions.push(
        offset.x + centerX - half,
        offset.y + y,
        offset.z - 0.008,
        offset.x + centerX,
        offset.y + y + notch,
        offset.z - 0.008,
        offset.x + centerX + half,
        offset.y + y,
        offset.z - 0.008,
      );
      uvs.push(0, t, 0.5, t, 1, t);
    }
    for (let row = 0; row < segments; row++) {
      const a = start + row * 3;
      const b = a + 3;
      indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function signumClothMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.78, metalness: 0, side: DoubleSide });
  const phase = float(instanceIndex).mul(2.399963);
  const drop = uv().y;
  const flutter = time.mul(2.4).add(phase).add(drop.mul(3.1)).sin().mul(0.026).mul(drop);
  const drift = time.mul(1.7).add(phase).cos().mul(0.012).mul(drop);
  const active = positionLocal.dot(positionLocal).greaterThan(1e-6);
  material.positionNode = select(active, positionLocal.add(vec3(drift, 0, flutter)), positionLocal);
  material.colorNode = varying(attribute<"vec3">("signumClothColor", "vec3")).setInterpolation("flat");
  material.name = "order-signum-cloth";
  return material;
}

function signumEmblemGeometry(offset: SignumOffset): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [facing, zOffset] of [
    [1, PLAQUE_DEPTH / 2 + 0.004],
    [-1, -(PLAQUE_DEPTH / 2 + 0.004)],
  ] as const) {
    const center = positions.length / 3;
    positions.push(offset.x, offset.y + PLAQUE_Y, offset.z + zOffset);
    uvs.push(0.5, 0.5);
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 2 - (corner * Math.PI) / 3;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      positions.push(offset.x + x * EMBLEM_RADIUS, offset.y + PLAQUE_Y + y * EMBLEM_RADIUS, offset.z + zOffset);
      uvs.push(0.5 + x * facing * 0.44, 0.5 - y * 0.44);
    }
    for (let corner = 0; corner < 6; corner++) {
      const next = (corner + 1) % 6;
      if (facing > 0) indices.push(center, center + 1 + next, center + 1 + corner);
      else indices.push(center, center + 1 + corner, center + 1 + next);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function signumEmblemMaterial(atlas: CanvasTexture): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  const cell = varying(attribute<"float">("signumOrderCell", "float")).setInterpolation("flat");
  const insetUv = uv().mul(0.96).add(0.02);
  const atlasUv = vec2(
    insetUv.x.add(cell.mod(ATLAS_COLUMNS)).div(ATLAS_COLUMNS),
    insetUv.y.add(cell.div(ATLAS_COLUMNS).floor()).div(ATLAS_ROWS),
  );
  material.colorNode = tslTexture(atlas, atlasUv).rgb;
  material.name = "order-signum-emblem";
  return material;
}

function createSignumAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Order signum atlas canvas is unavailable");
  context.fillStyle = SLATE_HEX;
  context.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  const atlas = new CanvasTexture(canvas);
  atlas.name = "Order signum facets";
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.generateMipmaps = false;
  atlas.minFilter = LinearFilter;
  return atlas;
}

function paintSignumAtlas(atlas: CanvasTexture, images: readonly HTMLImageElement[]): void {
  const canvas = atlas.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Order signum atlas canvas is unavailable");
  context.fillStyle = SLATE_HEX;
  context.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  for (const [index, image] of images.entries()) {
    const col = index % ATLAS_COLUMNS;
    const row = Math.floor(index / ATLAS_COLUMNS);
    const pad = Math.round(CELL_WIDTH * 0.08);
    context.drawImage(
      image,
      col * CELL_WIDTH + pad,
      row * CELL_HEIGHT + pad,
      CELL_WIDTH - pad * 2,
      CELL_HEIGHT - pad * 2,
    );
  }
  atlas.needsUpdate = true;
}
