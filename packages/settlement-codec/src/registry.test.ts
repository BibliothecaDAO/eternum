import { describe, expect, it } from "vitest";

import {
  computeSchemaRegistryHash,
  getActionSchema,
  getClaimKind,
  getSchemaRegistryHash,
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

  it("accepts emitter lists at one and eight and rejects zero and nine", () => {
    expect(validateEmitterCount(1)).toBe(1);
    expect(validateEmitterCount(8)).toBe(8);
    expect(() => validateEmitterCount(0)).toThrow("emitter count must be between 1 and 8");
    expect(() => validateEmitterCount(9)).toThrow("emitter count must be between 1 and 8");
  });

  it("recomputes the frozen full registry hash", () => {
    expect(getSchemaRegistryHash()).toBe("0x2d081aa3e28ce80cad3b11fab0fc47ba4c8835e1d2b65fec99ffc1133450530");
    expect(computeSchemaRegistryHash()).toBe(getSchemaRegistryHash());
  });
});
