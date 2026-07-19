import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import goldenVectors from "../schema/golden-vectors-v1.json";

import { decodeSchema, encodeSchema, type SchemaValue } from "./codec";

describe("canonical settlement codec", () => {
  it("encodes u256 as explicit low and high u128 limbs", () => {
    expect(
      encodeSchema("ClaimLeg", {
        asset_mode: 1,
        asset_id: 37,
        backing_pool_id: 2,
        recipient: 3,
        amount_or_token_id: (1n << 128n) + 5n,
        policy_key: 4,
      }),
    ).toEqual([1n, 37n, 2n, 3n, 5n, 1n, 4n]);
  });

  it("pins the full settlement-root count-before-hash field order", () => {
    expect(
      encodeSchema("SettlementRootMessage", {
        batch_id: 1,
        previous_batch_hash: 2,
        leaf_count: 3,
        root: 4,
        asset_totals_hash: 5,
        ingress_activation_count: 6,
        ingress_activations_hash: 7,
        nft_reservation_count: 8,
        nft_reservations_hash: 9,
        deployment_refund_count: 10,
        deployment_refunds_hash: 11,
        lot_share_promotion_count: 12,
        lot_share_promotions_hash: 13,
      }),
    ).toEqual([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n, 13n]);
  });

  it("rejects trailing fields and noncanonical booleans", () => {
    expect(() => decodeSchema("GameResult", [1n, 2n, 3n, 4n, 2n, 6n, 7n, 8n])).toThrow("noncanonical bool");
    expect(() =>
      decodeSchema(
        "ProtocolEnvelope",
        Array.from({ length: 11 }, (_, index) => BigInt(index)),
      ),
    ).toThrow("trailing felts");
  });

  it("matches every declared struct golden vector", () => {
    for (const vector of goldenVectors.schemas) {
      expect(encodeSchema(vector.schema, vector.value as SchemaValue), vector.schema).toEqual(vector.felts.map(BigInt));
    }
  });

  it("matches every fixed-depth empty-node vector", () => {
    for (const tree of goldenVectors.trees) {
      let current = hash.computePoseidonHashOnElements([hash.getSelectorFromName(tree.emptyLeafDomain)]);
      expect(current, `${tree.name} depth 0`).toBe(tree.emptyNodes[0]);
      const nodeDomain = hash.getSelectorFromName(tree.nodeDomain);
      for (let depth = 1; depth < tree.emptyNodes.length; depth += 1) {
        current = hash.computePoseidonHashOnElements([nodeDomain, current, current]);
        expect(current, `${tree.name} depth ${depth}`).toBe(tree.emptyNodes[depth]);
      }
    }
  });
});
