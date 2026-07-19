import { hash } from "starknet";

type FeltInput = bigint | number | string;
const FELT_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

export interface FixedDepthTreeConfig {
  depth: number;
  emptyLeafDomain: FeltInput;
  nodeDomain: FeltInput;
}

export interface FixedDepthProof {
  depth: number;
  leafHash: FeltInput;
  leafIndex: number;
  nodeDomain: FeltInput;
  root: FeltInput;
  siblings: readonly FeltInput[];
}

export class FixedDepthTree {
  readonly #config: ResolvedTreeConfig;
  readonly #leaves: string[] = [];

  constructor(config: FixedDepthTreeConfig) {
    this.#config = resolveConfig(config);
  }

  append(leafHash: FeltInput): number {
    if (BigInt(this.#leaves.length) >= capacity(this.#config.depth)) {
      throw new Error("tree capacity exceeded");
    }
    this.#leaves.push(canonicalFelt(leafHash));
    return this.#leaves.length - 1;
  }

  root(): string {
    return buildLevels(this.#config, this.#leaves).at(-1)!.get(0) ?? this.#config.emptyNodes.at(-1)!;
  }

  proof(leafIndex: number): string[] {
    assertIndex(this.#config.depth, leafIndex);
    const levels = buildLevels(this.#config, this.#leaves);
    let index = leafIndex;
    return levels.slice(0, -1).map((level, depth) => {
      const sibling = level.get(index ^ 1) ?? this.#config.emptyNodes[depth];
      index = Math.floor(index / 2);
      return sibling;
    });
  }
}

export function verifyFixedDepthProof(proof: FixedDepthProof): boolean {
  assertDepth(proof.depth);
  if (proof.siblings.length !== proof.depth) {
    throw new Error(`proof must contain exactly ${proof.depth} siblings`);
  }
  assertIndex(proof.depth, proof.leafIndex);
  const nodeDomain = resolveDomain(proof.nodeDomain);
  let current = canonicalFelt(proof.leafHash);
  let index = proof.leafIndex;
  for (const siblingInput of proof.siblings) {
    const sibling = canonicalFelt(siblingInput);
    current = index & 1 ? poseidon(nodeDomain, sibling, current) : poseidon(nodeDomain, current, sibling);
    index = Math.floor(index / 2);
  }
  return BigInt(current) === BigInt(proof.root);
}

interface ResolvedTreeConfig {
  depth: number;
  nodeDomain: string;
  emptyNodes: readonly string[];
}

function resolveConfig(config: FixedDepthTreeConfig): ResolvedTreeConfig {
  assertDepth(config.depth);
  const nodeDomain = resolveDomain(config.nodeDomain);
  const emptyNodes = [poseidon(resolveDomain(config.emptyLeafDomain))];
  for (let depth = 0; depth < config.depth; depth += 1) {
    emptyNodes.push(poseidon(nodeDomain, emptyNodes[depth], emptyNodes[depth]));
  }
  return { depth: config.depth, nodeDomain, emptyNodes };
}

function buildLevels(config: ResolvedTreeConfig, leaves: readonly string[]): Map<number, string>[] {
  const levels = [new Map(leaves.map((leaf, index) => [index, leaf]))];
  for (let depth = 0; depth < config.depth; depth += 1) {
    const current = levels[depth];
    const parents = new Set([...current.keys()].map((index) => Math.floor(index / 2)));
    const next = new Map<number, string>();
    for (const parent of parents) {
      const left = current.get(parent * 2) ?? config.emptyNodes[depth];
      const right = current.get(parent * 2 + 1) ?? config.emptyNodes[depth];
      next.set(parent, poseidon(config.nodeDomain, left, right));
    }
    levels.push(next);
  }
  return levels;
}

function resolveDomain(domain: FeltInput): string {
  if (typeof domain === "string" && !domain.startsWith("0x") && !/^\d+$/.test(domain)) {
    return hash.getSelectorFromName(domain);
  }
  return canonicalFelt(domain);
}

function poseidon(...values: FeltInput[]): string {
  return hash.computePoseidonHashOnElements(values.map(String));
}

function canonicalFelt(value: FeltInput): string {
  const felt = BigInt(value);
  if (felt < 0n || felt >= FELT_PRIME) throw new Error("felt outside Stark field");
  return `0x${felt.toString(16)}`;
}

function assertDepth(depth: number) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 252) throw new Error("tree depth must be between 1 and 252");
}

function assertIndex(depth: number, index: number) {
  if (!Number.isSafeInteger(index) || index < 0 || BigInt(index) >= capacity(depth)) {
    throw new Error("leaf index outside tree capacity");
  }
}

function capacity(depth: number): bigint {
  return 1n << BigInt(depth);
}
