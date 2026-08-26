import { describe, expect, it, vi } from "vitest";

import { assertBindableGameplayAccount } from "./gameplay-account";

const EXPECTED = {
  authority: "0x4",
  classHash: "0x1",
  owner: "0x2",
  publicKey: "0x3",
};

const createProvider = (overrides: Partial<typeof EXPECTED> = {}) => {
  const values = { ...EXPECTED, ...overrides };
  return {
    getClassHashAt: vi.fn().mockResolvedValue(values.classHash),
    callContract: vi.fn().mockImplementation(({ entrypoint }: { entrypoint: string }) => {
      if (entrypoint === "owner") return Promise.resolve([values.owner]);
      if (entrypoint === "get_public_key") return Promise.resolve([values.publicKey]);
      if (entrypoint === "binding_authority") return Promise.resolve([values.authority]);
      throw new Error(`Unexpected entrypoint ${entrypoint}`);
    }),
  };
};

const validate = (provider: ReturnType<typeof createProvider>) =>
  assertBindableGameplayAccount({
    provider,
    expectedAuthority: EXPECTED.authority,
    expectedClassHash: EXPECTED.classHash,
    gameplayAddress: "0x5",
    owner: EXPECTED.owner,
    publicKey: EXPECTED.publicKey,
  });

describe("assertBindableGameplayAccount", () => {
  it("accepts the expected account class, owner, key, and authority", async () => {
    await expect(validate(createProvider())).resolves.toBeUndefined();
  });

  it.each([
    ["class", { classHash: "0xa" }, "not a RealmsPlayerAccount"],
    ["owner", { owner: "0xa" }, "belongs to another identity"],
    ["public key", { publicKey: "0xa" }, "has another public key"],
    ["authority", { authority: "0xa" }, "has another binding authority"],
  ])("refuses an account with the wrong %s", async (_field, overrides, message) => {
    await expect(validate(createProvider(overrides))).rejects.toThrow(message);
  });
});
