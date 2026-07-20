import { describe, expect, it } from "vitest";

import {
  computeSchemaRegistryHash,
  getActionSchema,
  getClaimKind,
  getIndexFamily,
  getIndexFamilyByName,
  getSchemaRegistryHash,
  getTreeSchema,
  validateEmitterCount,
} from "./index";

describe("settlement schema registry", () => {
  it("resolves only registered action/version pairs", () => {
    expect(getActionSchema(1, 0x0110)).toMatchObject({
      name: "RESOURCE_DEPOSIT",
      body: "ResourceDepositMessage",
    });
    expect(() => getActionSchema(2, 0x0110)).toThrow("unsupported protocol version");
    expect(() => getActionSchema(1, 0xffff)).toThrow("unregistered action");
  });

  it("uses append-only dense claim-kind indices", () => {
    expect(getClaimKind(0x1001)).toMatchObject({ index: 0, name: "CONTROL_PLAYER_BINDING_ACK" });
    expect(getClaimKind(0x1030)).toMatchObject({ index: 9, name: "PAYOUT_FEE_DISTRIBUTION" });
    expect(() => getClaimKind(0xffff)).toThrow("unregistered claim kind");
  });

  it("reserves the deployment-refund materialization family outside World families", () => {
    expect(getIndexFamily(1)).toEqual({ code: 1, name: "RESOURCE", scope: "world" });
    expect(getIndexFamilyByName("EXIT_POSITION")).toEqual({ code: 12, name: "EXIT_POSITION", scope: "world" });
    expect(getIndexFamilyByName("DEPLOYMENT_REFUND_SOURCE")).toEqual({
      code: 65_535,
      name: "DEPLOYMENT_REFUND_SOURCE",
      scope: "deployment",
    });
    expect(() => getIndexFamily(13)).toThrow("unregistered index family");
  });

  it("accepts emitter lists at one and eight and rejects zero and nine", () => {
    expect(validateEmitterCount(1)).toBe(1);
    expect(validateEmitterCount(8)).toBe(8);
    expect(() => validateEmitterCount(0)).toThrow("emitter count must be between 1 and 8");
    expect(() => validateEmitterCount(9)).toThrow("emitter count must be between 1 and 8");
  });

  it("recomputes the frozen full registry hash", () => {
    expect(getSchemaRegistryHash()).toBe("0x3c0d5bcc57346e38b6ddf4dc41f9c6f2c65e2094b42985a10c959402e7d9a1c");
    expect(computeSchemaRegistryHash()).toBe(getSchemaRegistryHash());
  });

  it("freezes distinct depth-32 ranking and MMR-plan trees", () => {
    expect(getTreeSchema("ranking")).toEqual({
      name: "ranking",
      depth: 32,
      capacity: 4_294_967_296,
      leafDomain: "RANKING_LEAF_V1",
      emptyLeafDomain: "RANKING_EMPTY_LEAF_V1",
      nodeDomain: "RANKING_NODE_V1",
    });
    expect(getTreeSchema("mmr-plan")).toEqual({
      name: "mmr-plan",
      depth: 32,
      capacity: 4_294_967_296,
      leafDomain: "MMR_PLAN_LEAF_V1",
      emptyLeafDomain: "MMR_PLAN_EMPTY_LEAF_V1",
      nodeDomain: "MMR_PLAN_NODE_V1",
    });
    expect(getTreeSchema("ranking").nodeDomain).not.toBe(getTreeSchema("mmr-plan").nodeDomain);
  });

  it("isolates canonical schemas from consumer mutations", () => {
    const action = getActionSchema(1, 0x0110);
    const claimKind = getClaimKind(0x1001);
    const tree = getTreeSchema("ranking");

    action.name = "consumer-rewrite";
    claimKind.name = "consumer-rewrite";
    tree.nodeDomain = "consumer-rewrite";

    expect(getActionSchema(1, 0x0110).name).toBe("RESOURCE_DEPOSIT");
    expect(getClaimKind(0x1001).name).toBe("CONTROL_PLAYER_BINDING_ACK");
    expect(getTreeSchema("ranking").nodeDomain).toBe("RANKING_NODE_V1");
  });
});
