import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  serverEnv: {
    GAME_RPC_URL: "http://127.0.0.1:5050",
    PLAYER_REGISTRY_ADDRESS: "0x6",
  },
}));

import { assertBindableGameplayAccount, runSerializedAuthorityCall } from "./binding";

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

describe("authority call execution", () => {
  it("submits one authority transaction at a time", async () => {
    const sequence: string[] = [];
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runSerializedAuthorityCall(async () => {
      sequence.push("first:start");
      await firstCanFinish;
      sequence.push("first:end");
      return "first";
    });
    const second = runSerializedAuthorityCall(() => {
      sequence.push("second:start");
      return Promise.resolve("second");
    });

    await vi.waitFor(() => expect(sequence).toEqual(["first:start"]));
    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(sequence).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("retries one nonce rejection with a fresh submission", async () => {
    const call = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Invalid transaction nonce. Expected 2, got 1"))
      .mockResolvedValueOnce("0xhash");

    await expect(runSerializedAuthorityCall(call)).resolves.toBe("0xhash");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not retry other failures", async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("execution reverted"));

    await expect(runSerializedAuthorityCall(call)).rejects.toThrow("execution reverted");
    expect(call).toHaveBeenCalledOnce();
  });
});
