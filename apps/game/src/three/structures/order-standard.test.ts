import { iconUrl, orderMeaning } from "@/ui/design-system/icon-meaning";
import { aspects, catalogOrder, orders } from "@bibliothecadao/types";
import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  HalfFloatType,
  ImageLoader,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLCoordinateSystem,
} from "three";
import { context } from "three/tsl";
import * as ThreeWebGPU from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ORDER_STANDARD_NAME, OrderStandard, resolveOrderSignumCell } from "./order-standard";
import { SettlementModel } from "./settlement-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshStandardMaterial() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubCanvas() {
  const ops: string[] = [];
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
    set globalCompositeOperation(value: string) {
      ops.push(value);
    },
    get globalCompositeOperation() {
      return ops.at(-1) ?? "source-over";
    },
  };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  return { context, ops };
}

function triangleCount(mesh: InstancedMesh): number {
  const { index } = mesh.geometry;
  return index ? index.count / 3 : mesh.geometry.getAttribute("position").count / 3;
}

describe("order stone signum", () => {
  it("stays under the 600-triangle budget, shares Realm placement, and paints Order cloth, Aspect finial and full-colour Facet cells", async () => {
    const { context, ops } = stubCanvas();
    const load = vi
      .spyOn(ImageLoader.prototype, "loadAsync")
      .mockResolvedValue({ width: 512, height: 512 } as HTMLImageElement);
    const host = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 4);
    host.count = 2;
    const signum = new OrderStandard(host);
    const totalTriangles = triangleCount(signum.body) + triangleCount(signum.cloth) + triangleCount(signum.emblem);
    expect(totalTriangles).toBeLessThanOrEqual(600);
    expect(signum.body.castShadow).toBe(false);
    expect(signum.body.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.cloth.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.emblem.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.body.count).toBe(2);
    const finialAspect = signum.body.geometry.getAttribute("finialAspect");
    const presentFinials = new Set(Array.from({ length: finialAspect.count }, (_, index) => finialAspect.getX(index)));
    for (const entry of aspects) expect(presentFinials.has(entry.id)).toBe(true);

    await signum.prepare();
    expect(load).toHaveBeenCalledTimes(orders.length);
    for (const order of orders) {
      expect(load).toHaveBeenCalledWith(iconUrl(orderMeaning(order.orderId), 256));
    }
    expect(context.drawImage).toHaveBeenCalledTimes(orders.length);
    expect(ops).not.toContain("source-in");

    const power = catalogOrder(12);
    const fox = catalogOrder(4);
    signum.setOrderAt(0, power.orderId);
    signum.setOrderAt(1, fox.orderId);
    const aspect = signum.body.geometry.getAttribute("signumAspect");
    const cloth = signum.cloth.geometry.getAttribute("signumClothColor");
    const cell = signum.emblem.geometry.getAttribute("signumOrderCell");
    expect(aspect.getX(0)).toBe(power.aspect);
    expect(aspect.getX(1)).toBe(fox.aspect);
    expect(cell.getX(0)).toBe(resolveOrderSignumCell(power.orderId));
    expect(cell.getX(1)).toBe(resolveOrderSignumCell(fox.orderId));
    const powerColor = new Color(power.color);
    expect([cloth.getX(0), cloth.getY(0), cloth.getZ(0)]).toEqual([
      Math.fround(powerColor.r),
      Math.fround(powerColor.g),
      Math.fround(powerColor.b),
    ]);

    signum.setOrderAt(0, undefined);
    expect(aspect.getX(0)).toBe(0);
    expect(cell.getX(0)).toBe(resolveOrderSignumCell(undefined));

    const disposeBody = vi.spyOn(signum.body.geometry, "dispose");
    signum.dispose();
    signum.dispose();
    expect(disposeBody).toHaveBeenCalledOnce();
    host.geometry.dispose();
    (host.material as MeshStandardMaterial).dispose();
    host.dispose();
  });

  it("mounts beside Realms in SettlementModel and stays absent on Villages", () => {
    stubCanvas();
    const build = (kind: "realm" | "village") => {
      const scene = new Group();
      scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
      return new SettlementModel({ scene, animations: [] } as unknown as GLTF, 3, kind);
    };
    const realm = build("realm");
    const village = build("village");
    expect(realm.group.getObjectByName(ORDER_STANDARD_NAME)).toBeDefined();
    expect(village.group.getObjectByName(ORDER_STANDARD_NAME)).toBeUndefined();
    realm.setCount(2);
    const signum = realm.group.getObjectByName(ORDER_STANDARD_NAME)!;
    expect((signum.getObjectByName("Order signum stone") as InstancedMesh).count).toBe(2);
    realm.dispose();
    village.dispose();
  });

  it("supports standalone instanced placement for Deep sites and gates", () => {
    stubCanvas();
    const standards = OrderStandard.standalone(4);
    expect(standards.body.count).toBe(0);
    const matrix = new Matrix4().makeTranslation(3, 0, 5);
    standards.setMatrixAt(0, matrix);
    standards.setOrderAt(0, catalogOrder(12).orderId);
    standards.setCount(1);
    standards.needsUpdate();
    expect(standards.body.count).toBe(1);
    expect(standards.cloth.count).toBe(1);
    expect(standards.emblem.count).toBe(1);
    const read = new Matrix4();
    standards.cloth.getMatrixAt(0, read);
    expect(read.elements).toEqual(matrix.elements);
    standards.dispose();
  });

  it("shares one painted Facet atlas across every OrderStandard and disposes it when the last owner disposes", async () => {
    const createCanvas = vi.fn(() => {
      const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
      return { width: 0, height: 0, getContext: () => context };
    });
    vi.stubGlobal("document", { createElement: createCanvas });
    vi.spyOn(ImageLoader.prototype, "loadAsync").mockResolvedValue({ width: 256, height: 256 } as HTMLImageElement);
    const first = OrderStandard.standalone(2);
    const second = OrderStandard.standalone(2);
    expect(createCanvas).toHaveBeenCalledTimes(1);
    await Promise.all([first.prepare(), second.prepare()]);
    const firstContext = createCanvas.mock.results[0]!.value.getContext();
    expect(firstContext.drawImage).toHaveBeenCalledTimes(orders.length);

    first.dispose();
    const third = OrderStandard.standalone(2);
    expect(createCanvas).toHaveBeenCalledTimes(1);
    second.dispose();
    third.dispose();

    const fresh = OrderStandard.standalone(2);
    expect(createCanvas).toHaveBeenCalledTimes(2);
    fresh.dispose();
  });

  it("draws placed body, cloth and emblem at the same instance matrix, collapses hidden slots and finials, and shares chunk bounds with the realm", () => {
    stubCanvas();
    const standalone = OrderStandard.standalone(3);
    expect(standalone.body.frustumCulled).toBe(false);
    expect(standalone.cloth.frustumCulled).toBe(false);
    expect(standalone.emblem.frustumCulled).toBe(false);

    const hiddenSlot = new Matrix4();
    standalone.body.getMatrixAt(1, hiddenSlot);
    expect(hiddenSlot.elements[0]).toBe(0);
    expect(hiddenSlot.elements[5]).toBe(0);
    expect(hiddenSlot.elements[10]).toBe(0);

    const offset = new Vector3(40, 2, -15);
    const placed = new Matrix4().makeTranslation(offset.x, offset.y, offset.z);
    standalone.setMatrixAt(0, placed);
    standalone.setCount(2);
    const bodyVertex = compileWebGLVertexShader(standalone.body);
    const clothVertex = compileWebGLVertexShader(standalone.cloth);
    const emblemVertex = compileWebGLVertexShader(standalone.emblem);

    const emblemLocal = readVertexVec3(standalone.emblem, 0);
    const emblemDrawn = evaluateVertexPosition(emblemVertex, {
      position: emblemLocal,
      uv: readVertexVec2(standalone.emblem, 0),
      instanceMatrix: placed,
    });
    expectCloseVec3(
      emblemDrawn,
      [emblemLocal[0] + offset.x, emblemLocal[1] + offset.y, emblemLocal[2] + offset.z],
      1e-4,
      emblemVertex,
    );

    const poleIndex = findVertexIndex(standalone.body, "finialAspect", (value) => value === 0);
    const poleLocal = readVertexVec3(standalone.body, poleIndex);
    const poleDrawn = evaluateVertexPosition(bodyVertex, {
      position: poleLocal,
      finialAspect: 0,
      signumAspect: 2,
      instanceMatrix: placed,
    });
    expectCloseVec3(poleDrawn, [poleLocal[0] + offset.x, poleLocal[1] + offset.y, poleLocal[2] + offset.z]);

    const luminaryIndex = findVertexIndex(standalone.body, "finialAspect", (value) => value === 2);
    const luminaryLocal = readVertexVec3(standalone.body, luminaryIndex);
    const luminaryDrawn = evaluateVertexPosition(bodyVertex, {
      position: luminaryLocal,
      finialAspect: 2,
      signumAspect: 2,
      instanceMatrix: placed,
    });
    expectCloseVec3(luminaryDrawn, [
      luminaryLocal[0] + offset.x,
      luminaryLocal[1] + offset.y,
      luminaryLocal[2] + offset.z,
    ]);

    const hiddenFinialIndex = findVertexIndex(standalone.body, "finialAspect", (value) => value === 1);
    const hiddenFinialDrawn = evaluateVertexPosition(bodyVertex, {
      position: readVertexVec3(standalone.body, hiddenFinialIndex),
      finialAspect: 1,
      signumAspect: 2,
      instanceMatrix: placed,
    });
    expectCloseVec3(hiddenFinialDrawn, [0, 0, 0]);

    const clothIndex = findVertexIndex(standalone.cloth, "uv", (_, y) => y > 0.5);
    const clothLocal = readVertexVec3(standalone.cloth, clothIndex);
    const clothUv = readVertexVec2(standalone.cloth, clothIndex);
    const clothDrawn = evaluateVertexPosition(clothVertex, {
      position: clothLocal,
      uv: clothUv,
      instanceMatrix: placed,
      time: 1.25,
    });
    expectCloseVec3(clothDrawn, [clothLocal[0] + offset.x, clothLocal[1] + offset.y, clothLocal[2] + offset.z], 0.03);

    expectCloseVec3(
      evaluateVertexPosition(emblemVertex, { position: emblemLocal, uv: [0.5, 0.5], instanceMatrix: hiddenSlot }),
      [0, 0, 0],
    );
    expectCloseVec3(
      evaluateVertexPosition(bodyVertex, {
        position: poleLocal,
        finialAspect: 0,
        signumAspect: 2,
        instanceMatrix: hiddenSlot,
      }),
      [0, 0, 0],
    );
    expectCloseVec3(
      evaluateVertexPosition(clothVertex, {
        position: clothLocal,
        uv: clothUv,
        instanceMatrix: hiddenSlot,
        time: 1.25,
      }),
      [0, 0, 0],
    );
    standalone.dispose();

    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const realm = new SettlementModel({ scene, animations: [] } as unknown as GLTF, 3, "realm");
    const signum = realm.group.getObjectByName(ORDER_STANDARD_NAME)!;
    const meshes = ["Order signum stone", "Order signum cloth", "Order signum emblem"].map(
      (name) => signum.getObjectByName(name) as InstancedMesh,
    );
    for (const mesh of meshes) expect(mesh.frustumCulled).toBe(false);

    const bounds = {
      box: new Box3(new Vector3(10, -2, 20), new Vector3(40, 8, 50)),
      sphere: new Sphere(new Vector3(25, 3, 35), 25),
    };
    realm.setWorldBounds(bounds);
    const realmMesh = realm.instancedMeshes[0]!;
    for (const mesh of meshes) {
      expect(mesh.frustumCulled).toBe(realmMesh.frustumCulled);
      expect(mesh.boundingBox?.equals(realmMesh.boundingBox!)).toBe(true);
      expect(mesh.boundingSphere?.equals(realmMesh.boundingSphere!)).toBe(true);
    }

    realm.setWorldBounds(undefined);
    for (const mesh of meshes) expect(mesh.frustumCulled).toBe(realmMesh.frustumCulled);

    const restored = new InstancedBufferAttribute(new Float32Array(16 * 3), 16);
    realm.setMatricesAndCount(restored, 2);
    for (const mesh of meshes) expect(mesh.count).toBe(2);
    realm.setMatricesAndCount(restored, 0);
    for (const mesh of meshes) expect(mesh.count).toBe(0);

    realm.dispose();
  });
});

type WebGLNodeBuilder = {
  camera: PerspectiveCamera;
  build: () => void;
  vertexShader: string;
};

type WebGLBackendConstructor = new () => {
  capabilities: unknown;
  createNodeBuilder: (object: Mesh, renderer: unknown) => WebGLNodeBuilder;
};

type GlslMatrix = { readonly size: 3 | 4; readonly elements: number[] };
type GlslValue = number | number[] | GlslMatrix | GlslMatrix[];
type GlslStatement =
  | { readonly kind: "assign"; readonly target: string; readonly op: string; readonly rhs: string }
  | { readonly kind: "decl"; readonly name: string; readonly rhs?: string }
  | {
      readonly kind: "if";
      readonly cond: string;
      readonly thenBranch: GlslStatement[];
      readonly elseBranch: GlslStatement[];
    };

function compileWebGLVertexShader(mesh: InstancedMesh): string {
  const WebGLBackend = (ThreeWebGPU as unknown as { WebGLBackend: WebGLBackendConstructor }).WebGLBackend;
  const backend = new WebGLBackend();
  backend.capabilities = {
    getUniformBufferLimit: () => 65536,
    getMaxAnisotropy: () => 1,
    isWebGL2: () => true,
  };
  const renderer = {
    contextNode: context(),
    lighting: { enabled: false },
    debug: { diagnostics: { keywords: false } },
    backend,
    coordinateSystem: WebGLCoordinateSystem,
    outputColorSpace: SRGBColorSpace,
    currentColorSpace: SRGBColorSpace,
    toneMapping: NoToneMapping,
    shadowMap: { enabled: false, type: PCFShadowMap },
    nodes: { getForRenderCacheKey: () => "" },
    isWebGPURenderer: true,
    hasFeature: () => false,
    getMaxAnisotropy: () => 1,
    getRenderTarget: () => null,
    getCurrentRenderTarget: () => null,
    getMRT: () => null,
    getDrawingBufferSize: (out: { set: (w: number, h: number) => unknown }) => out.set(1, 1),
    getPixelRatio: () => 1,
    getClearColor: (color: unknown) => color,
    getClearAlpha: () => 1,
    getOutputBufferType: () => HalfFloatType,
    library: {
      fromMaterial: (candidate: unknown) => candidate,
      getLightNode: () => null,
      getLightsNode: () => null,
      getFogNode: () => null,
      getToneMappingFunction: () => null,
    },
  };
  const builder = backend.createNodeBuilder(mesh, renderer);
  builder.camera = new PerspectiveCamera();
  builder.build();
  return builder.vertexShader;
}

function readVertexVec3(mesh: InstancedMesh, index: number): [number, number, number] {
  const attr = mesh.geometry.getAttribute("position");
  return [attr.getX(index), attr.getY(index), attr.getZ(index)];
}

function readVertexVec2(mesh: InstancedMesh, index: number): [number, number] {
  const attr = mesh.geometry.getAttribute("uv");
  return [attr.getX(index), attr.getY(index)];
}

function findVertexIndex(mesh: InstancedMesh, attributeName: string, match: (x: number, y: number) => boolean): number {
  const attr = mesh.geometry.getAttribute(attributeName);
  for (let index = 0; index < attr.count; index++) {
    if (match(attr.getX(index), attr.itemSize > 1 ? attr.getY(index) : 0)) return index;
  }
  throw new Error(`No vertex matched ${attributeName}`);
}

function expectCloseVec3(
  actual: [number, number, number],
  expected: [number, number, number],
  tolerance = 1e-4,
  contextInfo = "",
): void {
  for (let axis = 0; axis < 3; axis++) {
    expect(Math.abs(actual[axis]! - expected[axis]!), contextInfo).toBeLessThanOrEqual(tolerance);
  }
}

function evaluateVertexPosition(
  shader: string,
  input: {
    position: [number, number, number];
    uv?: [number, number];
    finialAspect?: number;
    signumAspect?: number;
    instanceMatrix: Matrix4;
    instanceId?: number;
    time?: number;
  },
): [number, number, number] {
  const env = buildInitialGlslEnv(shader, input);
  const mainBody = extractMainBody(shader);
  const statements = sliceForTarget(parseStatements(mainBody), "gl_Position");
  executeStatements(statements, env);
  const clip = env.get("gl_Position");
  if (!clip || !isNumberArray(clip) || clip.length < 3) throw new Error("Vertex shader did not compute gl_Position");
  return [clip[0]!, clip[1]!, clip[2]!];
}

function buildInitialGlslEnv(
  shader: string,
  input: {
    position: [number, number, number];
    uv?: [number, number];
    finialAspect?: number;
    signumAspect?: number;
    instanceMatrix: Matrix4;
    instanceId?: number;
    time?: number;
  },
): Map<string, GlslValue> {
  const env = new Map<string, GlslValue>();
  const mainIndex = shader.indexOf("void main");
  const header = mainIndex >= 0 ? shader.slice(0, mainIndex) : shader;
  const mat4Identity = (): GlslMatrix => ({
    size: 4,
    elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  });
  const mat3Identity = (): GlslMatrix => ({ size: 3, elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  for (const match of header.matchAll(/\b(mat4|mat3|vec4|vec3|vec2|float|int|uint|bool)\s+([A-Za-z_]\w*)\s*;/g)) {
    const [, type, name] = match;
    if (type === "mat4") env.set(name!, mat4Identity());
    else if (type === "mat3") env.set(name!, mat3Identity());
    else if (type === "vec4") env.set(name!, [0, 0, 0, 0]);
    else if (type === "vec3") env.set(name!, [0, 0, 0]);
    else if (type === "vec2") env.set(name!, [0, 0]);
    else if (type === "float") env.set(name!, input.time ?? 0);
    else env.set(name!, 0);
  }
  const elements = [...input.instanceMatrix.elements];
  for (const match of header.matchAll(/\bmat4\s+([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]\s*;/g)) {
    const [, name, len] = match;
    env.set(
      name!,
      Array.from({ length: Number(len) }, () => ({ size: 4 as const, elements })),
    );
  }
  for (const match of header.matchAll(/\bin\s+(?:(?:highp|mediump|lowp)\s+)?mat4\s+([A-Za-z_]\w*)\s*;/g)) {
    env.set(match[1]!, { size: 4, elements });
  }
  env.set("instanceMatrix", { size: 4, elements });
  env.set("instanceMatrix0", elements.slice(0, 4));
  env.set("instanceMatrix1", elements.slice(4, 8));
  env.set("instanceMatrix2", elements.slice(8, 12));
  env.set("instanceMatrix3", elements.slice(12, 16));
  env.set("position", [...input.position]);
  env.set("uv", [...(input.uv ?? [0, 0])]);
  env.set("normal", [0, 1, 0]);
  env.set("color", [1, 1, 1]);
  env.set("finialAspect", input.finialAspect ?? 0);
  env.set("signumAspect", input.signumAspect ?? 0);
  env.set("signumOrderCell", 0);
  env.set("signumClothColor", [1, 1, 1]);
  env.set("gl_InstanceID", input.instanceId ?? 0);
  env.set("gl_VertexID", 0);
  return env;
}

function extractMainBody(shader: string): string {
  const start = shader.indexOf("void main");
  if (start < 0) throw new Error("Missing void main in vertex shader");
  const open = shader.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < shader.length; index++) {
    if (shader[index] === "{") depth++;
    else if (shader[index] === "}") {
      depth--;
      if (depth === 0) return shader.slice(open + 1, index);
    }
  }
  throw new Error("Unclosed void main in vertex shader");
}

function parseStatements(source: string): GlslStatement[] {
  const statements: GlslStatement[] = [];
  let index = 0;
  const skipWs = () => {
    while (index < source.length) {
      if (/\s/.test(source[index]!)) index++;
      else if (source.startsWith("//", index)) {
        const nl = source.indexOf("\n", index);
        index = nl < 0 ? source.length : nl + 1;
      } else if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index + 2);
        index = end < 0 ? source.length : end + 2;
      } else break;
    }
  };
  const readBalanced = (open: string, close: string): string => {
    let depth = 0;
    const start = index;
    while (index < source.length) {
      if (source[index] === open) depth++;
      else if (source[index] === close) {
        depth--;
        if (depth === 0) {
          index++;
          return source.slice(start + 1, index - 1);
        }
      }
      index++;
    }
    throw new Error(`Unclosed ${open}`);
  };
  const readBranch = (): GlslStatement[] => {
    skipWs();
    if (source[index] === "{") return parseStatements(readBalanced("{", "}"));
    const semi = source.indexOf(";", index);
    const raw = source.slice(index, semi).trim();
    index = semi + 1;
    const parsed = parseSimpleStatement(raw);
    return parsed ? [parsed] : [];
  };
  while (index < source.length) {
    skipWs();
    if (index >= source.length) break;
    if (source[index] === "{") {
      statements.push(...parseStatements(readBalanced("{", "}")));
      continue;
    }
    if (/^if\b/.test(source.slice(index))) {
      index += 2;
      skipWs();
      const cond = readBalanced("(", ")");
      const thenBranch = readBranch();
      skipWs();
      let elseBranch: GlslStatement[] = [];
      if (/^else\b/.test(source.slice(index))) {
        index += 4;
        elseBranch = readBranch();
      }
      statements.push({ kind: "if", cond, thenBranch, elseBranch });
      continue;
    }
    const semi = source.indexOf(";", index);
    if (semi < 0) break;
    const raw = source.slice(index, semi).trim();
    index = semi + 1;
    const parsed = parseSimpleStatement(raw);
    if (parsed) statements.push(parsed);
  }
  return statements;
}

function parseSimpleStatement(raw: string): GlslStatement | null {
  if (!raw) return null;
  const decl = raw.match(
    /^(?:(?:const|highp|mediump|lowp)\s+)*(?:bool|int|uint|float|vec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234])\s+([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/,
  );
  if (decl) return { kind: "decl", name: decl[1]!, rhs: decl[2]?.trim() };
  const assign = raw.match(/^([A-Za-z_]\w*(?:\.[xyzwrgba]+)?)\s*(\+|-|\*|\/)?=\s*([\s\S]+)$/);
  if (assign) return { kind: "assign", target: assign[1]!, op: assign[2] ?? "", rhs: assign[3]!.trim() };
  return null;
}

function identifiersIn(expr: string): string[] {
  return [...expr.matchAll(/\b[A-Za-z_]\w*\b/g)].map((match) => match[0]!);
}

function writtenNames(statements: GlslStatement[]): Set<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    if (statement.kind === "decl") names.add(statement.name);
    else if (statement.kind === "assign") names.add(statement.target.split(".")[0]!);
    else {
      for (const name of writtenNames(statement.thenBranch)) names.add(name);
      for (const name of writtenNames(statement.elseBranch)) names.add(name);
    }
  }
  return names;
}

function sliceForTarget(statements: GlslStatement[], target: string): GlslStatement[] {
  const needed = new Set<string>([target]);
  let changed = true;
  const keepSet = new Set<GlslStatement>();
  const markReads = (statement: GlslStatement) => {
    if (statement.kind === "decl" && statement.rhs) identifiersIn(statement.rhs).forEach((id) => needed.add(id));
    else if (statement.kind === "assign") identifiersIn(statement.rhs).forEach((id) => needed.add(id));
    else if (statement.kind === "if") {
      identifiersIn(statement.cond).forEach((id) => needed.add(id));
      statement.thenBranch.forEach(markReads);
      statement.elseBranch.forEach(markReads);
    }
  };
  while (changed) {
    changed = false;
    for (const statement of statements) {
      if (keepSet.has(statement)) continue;
      const writes = writtenNames([statement]);
      if ([...writes].some((name) => needed.has(name))) {
        keepSet.add(statement);
        const before = needed.size;
        markReads(statement);
        if (needed.size > before) changed = true;
      }
    }
  }
  return statements.filter((statement) => keepSet.has(statement));
}

function executeStatements(statements: GlslStatement[], env: Map<string, GlslValue>): void {
  for (const statement of statements) {
    if (statement.kind === "decl") {
      env.set(statement.name, statement.rhs ? evaluateGlslExpr(statement.rhs, env) : 0);
    } else if (statement.kind === "assign") {
      const value = evaluateGlslExpr(statement.rhs, env);
      const [base, swizzle] = statement.target.split(".");
      if (!swizzle) {
        env.set(base!, statement.op ? applyBinaryOp(statement.op, env.get(base!) ?? 0, value) : value);
      } else {
        const current = [...(env.get(base!) as number[])];
        const parts = isNumberArray(value) ? value : [value as number];
        for (let i = 0; i < swizzle.length; i++) {
          const lane = swizzleIndex(swizzle[i]!);
          current[lane] = statement.op
            ? (applyBinaryOp(statement.op, current[lane]!, parts[i] ?? parts[0]!) as number)
            : (parts[i] ?? parts[0]!);
        }
        env.set(base!, current);
      }
    } else {
      const branch = toBool(evaluateGlslExpr(statement.cond, env)) ? statement.thenBranch : statement.elseBranch;
      executeStatements(branch, env);
    }
  }
}

function isMatrix(value: GlslValue): value is GlslMatrix {
  return typeof value === "object" && !Array.isArray(value);
}

function isNumberArray(value: GlslValue): value is number[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "number");
}

function toBool(value: GlslValue): boolean {
  return typeof value === "number" ? value !== 0 : true;
}

function swizzleIndex(ch: string): number {
  const map: Record<string, number> = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3, s: 0, t: 1, p: 2, q: 3 };
  return map[ch]!;
}

function applyBinaryOp(op: string, left: GlslValue, right: GlslValue): GlslValue {
  if (op === "*") {
    if (isMatrix(left) && isNumberArray(right)) {
      const n = left.size;
      const out = new Array<number>(n).fill(0);
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) out[row]! += left.elements[col * n + row]! * right[col]!;
      }
      return out;
    }
    if (isNumberArray(left) && isMatrix(right)) {
      const n = right.size;
      const out = new Array<number>(n).fill(0);
      for (let col = 0; col < n; col++) {
        for (let row = 0; row < n; row++) out[col]! += left[row]! * right.elements[col * n + row]!;
      }
      return out;
    }
    if (isMatrix(left) && isMatrix(right)) {
      const n = left.size;
      const out = new Array<number>(n * n).fill(0);
      for (let col = 0; col < n; col++) {
        for (let row = 0; row < n; row++) {
          let sum = 0;
          for (let k = 0; k < n; k++) sum += left.elements[k * n + row]! * right.elements[col * n + k]!;
          out[col * n + row] = sum;
        }
      }
      return { size: n, elements: out };
    }
  }
  const scalarOp = (a: number, b: number): number => {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return a / b;
    if (op === "<") return a < b ? 1 : 0;
    if (op === "<=") return a <= b ? 1 : 0;
    if (op === ">") return a > b ? 1 : 0;
    if (op === ">=") return a >= b ? 1 : 0;
    if (op === "==") return a === b ? 1 : 0;
    if (op === "!=") return a !== b ? 1 : 0;
    throw new Error(`Unsupported GLSL op ${op}`);
  };
  if (typeof left === "number" && typeof right === "number") return scalarOp(left, right);
  if (isNumberArray(left) && typeof right === "number") return left.map((v) => scalarOp(v, right));
  if (typeof left === "number" && isNumberArray(right)) return right.map((v) => scalarOp(left, v));
  if (isNumberArray(left) && isNumberArray(right)) return left.map((v, i) => scalarOp(v, right[i]!));
  throw new Error(`Unsupported GLSL operands for ${op}`);
}

function flattenScalars(values: GlslValue[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (typeof value === "number") out.push(value);
    else if (isNumberArray(value)) out.push(...value);
    else if (isMatrix(value)) out.push(...value.elements);
  }
  return out;
}

function callGlslFn(name: string, args: GlslValue[]): GlslValue {
  if (name === "float" || name === "int" || name === "uint") return flattenScalars(args)[0]!;
  if (name === "bool") return flattenScalars(args)[0]! !== 0 ? 1 : 0;
  if (name === "vec2" || name === "vec3" || name === "vec4") {
    const size = Number(name[3]);
    const scalars = flattenScalars(args);
    return scalars.length === 1 ? new Array<number>(size).fill(scalars[0]!) : scalars.slice(0, size);
  }
  if (name === "mat4") {
    const scalars = flattenScalars(args);
    if (scalars.length === 16) return { size: 4, elements: scalars };
    if (scalars.length === 1) {
      const s = scalars[0]!;
      return { size: 4, elements: [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, s] };
    }
  }
  if (name === "mat3") {
    if (args.length === 1 && isMatrix(args[0]!) && args[0]!.size === 4) {
      const e = args[0]!.elements;
      return { size: 3, elements: [e[0]!, e[1]!, e[2]!, e[4]!, e[5]!, e[6]!, e[8]!, e[9]!, e[10]!] };
    }
    const scalars = flattenScalars(args);
    if (scalars.length === 9) return { size: 3, elements: scalars };
  }
  const mapUnary = (fn: (v: number) => number): GlslValue => {
    const value = args[0]!;
    return isNumberArray(value) ? value.map(fn) : fn(value as number);
  };
  if (name === "abs") return mapUnary(Math.abs);
  if (name === "sin") return mapUnary(Math.sin);
  if (name === "cos") return mapUnary(Math.cos);
  if (name === "sqrt") return mapUnary(Math.sqrt);
  if (name === "floor") return mapUnary(Math.floor);
  if (name === "fract") return mapUnary((v) => v - Math.floor(v));
  if (name === "sign") return mapUnary(Math.sign);
  if (name === "dot") {
    const a = flattenScalars([args[0]!]);
    const b = flattenScalars([args[1]!]);
    return a.reduce((sum, v, i) => sum + v * b[i]!, 0);
  }
  if (name === "length") return Math.hypot(...flattenScalars([args[0]!]));
  if (name === "normalize") {
    const v = flattenScalars([args[0]!]);
    const len = Math.hypot(...v) || 1;
    return v.map((c) => c / len);
  }
  if (name === "min" || name === "max") {
    const fn = name === "min" ? Math.min : Math.max;
    const a = args[0]!;
    const b = args[1]!;
    if (typeof a === "number" && typeof b === "number") return fn(a, b);
    const av = isNumberArray(a) ? a : [a as number];
    const bv = isNumberArray(b) ? b : [b as number];
    return av.map((v, i) => fn(v, bv[i] ?? bv[0]!));
  }
  if (name === "mix") {
    const [a, b, t] = args;
    const tv = typeof t === "number" ? t : (t as number[])[0]!;
    if (typeof a === "number" && typeof b === "number") return a + (b - a) * tv;
    return (a as number[]).map((v, i) => v + ((b as number[])[i]! - v) * tv);
  }
  if (name === "clamp") {
    const [, lo, hi] = args as [GlslValue, number, number];
    return mapUnary((v) => Math.min(hi, Math.max(lo, v)));
  }
  throw new Error(`Unsupported GLSL builtin ${name}`);
}

function evaluateGlslExpr(source: string, env: Map<string, GlslValue>): GlslValue {
  const tokens = [
    ...source.matchAll(
      /\s*(?:(\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?)[uUfF]?|(<=|>=|==|!=|&&|\|\|)|([A-Za-z_]\w*)|([+\-*/<>!?:().,[\]]))/g,
    ),
  ].map((match) =>
    match[1] !== undefined
      ? { kind: "num", text: match[1] }
      : match[2]
        ? { kind: "op", text: match[2] }
        : match[3]
          ? { kind: "id", text: match[3] }
          : { kind: "op", text: match[4]! },
  );
  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = (expected?: string) => {
    const token = tokens[cursor++];
    if (expected && token?.text !== expected) throw new Error(`Expected ${expected}, got ${token?.text}`);
    return token!;
  };
  const parseTernary = (): GlslValue => {
    const cond = parseOr();
    if (peek()?.text !== "?") return cond;
    consume("?");
    const whenTrue = parseTernary();
    consume(":");
    const whenFalse = parseTernary();
    return toBool(cond) ? whenTrue : whenFalse;
  };
  const parseOr = (): GlslValue => {
    let value = parseAnd();
    while (peek()?.text === "||") {
      consume("||");
      const right = parseAnd();
      value = toBool(value) || toBool(right) ? 1 : 0;
    }
    return value;
  };
  const parseAnd = (): GlslValue => {
    let value = parseEq();
    while (peek()?.text === "&&") {
      consume("&&");
      const right = parseEq();
      value = toBool(value) && toBool(right) ? 1 : 0;
    }
    return value;
  };
  const parseEq = (): GlslValue => {
    let value = parseCmp();
    while (peek()?.text === "==" || peek()?.text === "!=") {
      const op = consume().text;
      value = applyBinaryOp(op, value, parseCmp());
    }
    return value;
  };
  const parseCmp = (): GlslValue => {
    let value = parseAdd();
    while (["<", "<=", ">", ">="].includes(peek()?.text ?? "")) {
      const op = consume().text;
      value = applyBinaryOp(op, value, parseAdd());
    }
    return value;
  };
  const parseAdd = (): GlslValue => {
    let value = parseMul();
    while (peek()?.text === "+" || peek()?.text === "-") {
      const op = consume().text;
      value = applyBinaryOp(op, value, parseMul());
    }
    return value;
  };
  const parseMul = (): GlslValue => {
    let value = parseUnary();
    while (peek()?.text === "*" || peek()?.text === "/") {
      const op = consume().text;
      value = applyBinaryOp(op, value, parseUnary());
    }
    return value;
  };
  const parseUnary = (): GlslValue => {
    if (peek()?.text === "-") {
      consume("-");
      return applyBinaryOp("*", -1, parseUnary());
    }
    if (peek()?.text === "+") {
      consume("+");
      return parseUnary();
    }
    if (peek()?.text === "!") {
      consume("!");
      return toBool(parseUnary()) ? 0 : 1;
    }
    return parsePostfix();
  };
  const parsePostfix = (): GlslValue => {
    let value = parsePrimary();
    while (peek()?.text === "." || peek()?.text === "[") {
      if (peek()?.text === ".") {
        consume(".");
        const swizzle = consume().text;
        const vec = value as number[];
        value = swizzle.length === 1 ? vec[swizzleIndex(swizzle)]! : [...swizzle].map((ch) => vec[swizzleIndex(ch)]!);
      } else {
        consume("[");
        const idx = Math.trunc(evaluateScalar(parseTernary()));
        consume("]");
        if (isMatrix(value)) {
          const n = value.size;
          value = value.elements.slice(idx * n, (idx + 1) * n);
        } else {
          value = (value as GlslValue[])[idx]!;
        }
      }
    }
    return value;
  };
  const evaluateScalar = (value: GlslValue): number => {
    if (typeof value !== "number") throw new Error("Expected scalar index");
    return value;
  };
  const parsePrimary = (): GlslValue => {
    const token = peek()!;
    if (token.kind === "num") {
      consume();
      return Number(token.text);
    }
    if (token.text === "(") {
      consume("(");
      const inner = parseTernary();
      consume(")");
      return inner;
    }
    if (token.kind === "id") {
      consume();
      if (token.text === "true") return 1;
      if (token.text === "false") return 0;
      if (peek()?.text === "(") {
        consume("(");
        const args: GlslValue[] = [];
        if (peek()?.text !== ")") {
          args.push(parseTernary());
          while (peek()?.text === ",") {
            consume(",");
            args.push(parseTernary());
          }
        }
        consume(")");
        return callGlslFn(token.text, args);
      }
      const value = env.get(token.text);
      if (value === undefined) throw new Error(`Unknown GLSL identifier ${token.text}`);
      return value;
    }
    throw new Error(`Unexpected GLSL token ${token.text}`);
  };
  return parseTernary();
}
