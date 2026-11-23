import { describe, expect, it } from "vitest";
import { vec2 } from "three/tsl";
import { cellHash } from "./terrain-cell-hash";

type TypedScalar = { kind: "float" | "int" | "uint"; value: number };
type TypedValue = TypedScalar | { kind: "vec2"; x: number; y: number };

type TslNode = {
  type?: string;
  constructor?: { name?: string };
  node?: TslNode;
  aNode?: TslNode;
  bNode?: TslNode;
  rawInputs?: TslNode[];
  op?: string;
  components?: string;
  nodeType?: string | null;
  convertTo?: string;
  value?: unknown;
};

function pcgFloat(seed: number): number {
  const u = seed >>> 0;
  const state = (Math.imul(u, 747796405) + 2891336453) >>> 0;
  const shift = ((state >>> 28) + 4) >>> 0;
  const word = Math.imul((state >>> shift) ^ state, 277803737) >>> 0;
  const result = ((word >>> 22) ^ word) >>> 0;
  return result / 2 ** 32;
}

function toScalar(value: TypedValue): TypedScalar {
  if (value.kind === "vec2") return { kind: "float", value: value.x };
  return value;
}

function evalNode(node: TslNode | undefined): TypedValue {
  if (!node) throw new Error("Missing TSL node");
  if (node.type === "VarNode" || node.type === "SubBuild") return evalNode(node.node);
  if (node.constructor?.name === "ShaderCallNodeInternal") {
    const seed = evalNode(node.rawInputs?.[0]);
    const scalar = toScalar(seed);
    const asUint = scalar.kind === "float" ? Math.max(0, Math.trunc(scalar.value)) >>> 0 : scalar.value >>> 0;
    return { kind: "float", value: pcgFloat(asUint) };
  }
  if (node.type === "ConvertNode") {
    const inner = toScalar(evalNode(node.node));
    const target = node.convertTo;
    if (target === "int") return { kind: "int", value: Math.trunc(inner.value) | 0 };
    if (target === "uint") {
      if (inner.kind === "float") return { kind: "uint", value: Math.max(0, Math.trunc(inner.value)) >>> 0 };
      return { kind: "uint", value: inner.value >>> 0 };
    }
    if (target === "float") return { kind: "float", value: inner.value };
    throw new Error(`Unsupported ConvertNode target ${String(target)}`);
  }
  if (node.type === "SplitNode") {
    const inner = evalNode(node.node);
    if (inner.kind !== "vec2") throw new Error(`Expected vec2 for SplitNode, got ${inner.kind}`);
    if (node.components === "x") return { kind: "float", value: inner.x };
    if (node.components === "y") return { kind: "float", value: inner.y };
    throw new Error(`Unsupported SplitNode components ${String(node.components)}`);
  }
  if (node.type === "ConstNode") {
    if (node.nodeType === "vec2" && node.value && typeof node.value === "object") {
      const pair = node.value as { x: number; y: number };
      return { kind: "vec2", x: pair.x, y: pair.y };
    }
    if (typeof node.value === "number") {
      const kind = node.nodeType === "uint" ? "uint" : node.nodeType === "int" ? "int" : "float";
      return { kind, value: kind === "uint" ? node.value >>> 0 : kind === "int" ? node.value | 0 : node.value };
    }
  }
  if (node.type === "OperatorNode") {
    const left = toScalar(evalNode(node.aNode));
    const right = toScalar(evalNode(node.bNode));
    if (node.op === "*") return { kind: "uint", value: Math.imul(left.value >>> 0, right.value >>> 0) >>> 0 };
    if (node.op === "^") return { kind: "uint", value: ((left.value >>> 0) ^ (right.value >>> 0)) >>> 0 };
    throw new Error(`Unsupported OperatorNode ${String(node.op)}`);
  }
  throw new Error(`Unsupported TSL node ${String(node.type)} (${String(node.constructor?.name)})`);
}

function sampleCell(x: number, y: number, salt = 0): number {
  const result = toScalar(evalNode(cellHash(vec2(x, y), salt) as unknown as TslNode));
  return result.value;
}

describe("2D terrain cell hash", () => {
  it("varies along y within a fixed x column so scattered ground details never form vertical stripes", () => {
    const column = new Set(Array.from({ length: 16 }, (_, y) => sampleCell(7, y, 1)));
    expect(column.size).toBe(16);
  });

  it("stays distinct across negative coordinates around the floating origin", () => {
    const negativeHalf = new Set<number>();
    for (let x = -8; x < 0; x += 1) {
      for (let y = -4; y < 4; y += 1) {
        const value = sampleCell(x, y, 2);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        negativeHalf.add(value);
      }
    }
    expect(negativeHalf.size).toBe(64);
  });

  it("produces independent streams for distinct salts on the same cell", () => {
    const streams = new Set([1, 2, 3, 4].map((salt) => sampleCell(-13, -9, salt)));
    expect(streams.size).toBe(4);
  });
});
