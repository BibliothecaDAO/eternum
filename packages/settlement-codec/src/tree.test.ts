import { describe, expect, it } from "vitest";
import vectors from "../schema/tree-vectors-v1.json";
import { getTreeSchema } from "./index";
import { FixedDepthTree, verifyFixedDepthProof } from "./tree";

describe("fixed-depth settlement trees", () => {
  it("matches 1/2/63/64, consecutive, partial, final, and depth-eight roots", () => {
    for (const vector of vectors.cases) {
      const config = resolveTree(vector.tree);
      const tree = new FixedDepthTree({ depth: vector.depth, ...config });
      vector.leafHashes.forEach((leaf) => tree.append(leaf));
      expect(tree.root(), vector.name).toBe(vector.root);

      for (const proof of vector.proofs) {
        expect(
          verifyFixedDepthProof({
            depth: vector.depth,
            leafHash: vector.leafHashes[proof.index],
            leafIndex: proof.index,
            nodeDomain: config.nodeDomain,
            root: vector.root,
            siblings: proof.siblings,
          }),
          `${vector.name}:${proof.index}`,
        ).toBe(true);
      }
    }
  });

  it("rejects capacity overflow and malformed proofs without changing the root", () => {
    const vector = vectors.cases.find(({ name }) => name === "full")!;
    const config = resolveTree(vector.tree);
    const tree = new FixedDepthTree({ depth: vector.depth, ...config });
    vector.leafHashes.forEach((leaf) => tree.append(leaf));
    const fullRoot = tree.root();
    expect(() => tree.append(1n)).toThrow("tree capacity exceeded");
    expect(tree.root()).toBe(fullRoot);
    expect(() => new FixedDepthTree({ depth: 0, ...config })).toThrow("tree depth must be between 1 and 252");

    const proof = vector.proofs[0];
    expect(() =>
      verifyFixedDepthProof({
        depth: vector.depth,
        leafHash: vector.leafHashes[0],
        leafIndex: 0,
        nodeDomain: config.nodeDomain,
        root: vector.root,
        siblings: proof.siblings.slice(1),
      }),
    ).toThrow("proof must contain exactly 6 siblings");

    expect(() =>
      verifyFixedDepthProof({
        depth: vector.depth,
        leafHash: vector.leafHashes[0],
        leafIndex: 64,
        nodeDomain: config.nodeDomain,
        root: vector.root,
        siblings: proof.siblings,
      }),
    ).toThrow("leaf index outside tree capacity");

    expect(
      verifyFixedDepthProof({
        depth: vector.depth,
        leafHash: vector.leafHashes[0],
        leafIndex: 0,
        nodeDomain: config.nodeDomain,
        root: vector.root,
        siblings: [1n, ...proof.siblings.slice(1)],
      }),
    ).toBe(false);
  });

  it("keeps ranking proofs domain-separated from MMR-plan proofs", () => {
    const ranking = vectors.cases.find(({ name }) => name === "ranking-three")!;
    const plan = vectors.cases.find(({ name }) => name === "mmr-plan-three")!;

    expect(ranking.root).not.toBe(plan.root);
    expect(
      verifyFixedDepthProof({
        depth: ranking.depth,
        leafHash: ranking.leafHashes[0],
        leafIndex: 0,
        nodeDomain: resolveTree("mmr-plan").nodeDomain,
        root: ranking.root,
        siblings: ranking.proofs[0].siblings,
      }),
    ).toBe(false);
  });
});

function resolveTree(name: string) {
  const { emptyLeafDomain, nodeDomain } = getTreeSchema(name);
  return { emptyLeafDomain, nodeDomain };
}
