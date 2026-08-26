import { describe, expect, it, vi } from "vitest";

import { authorizeSiwsNonce } from "./siws-verification";

describe("authorizeSiwsNonce", () => {
  it("does not consume the nonce when signature verification fails", async () => {
    const consumeNonce = vi.fn().mockResolvedValue(true);

    await expect(authorizeSiwsNonce({ verifySignature: async () => false, consumeNonce })).rejects.toThrow(
      "Invalid signature",
    );
    expect(consumeNonce).not.toHaveBeenCalled();
  });

  it("allows exactly one of two concurrent verifications to consume a nonce", async () => {
    let available = true;
    const consumeNonce = async () => {
      if (!available) return false;
      available = false;
      return true;
    };
    const attempt = () => authorizeSiwsNonce({ verifySignature: async () => true, consumeNonce });

    const results = await Promise.allSettled([attempt(), attempt()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("refuses a sequential replay after the nonce is consumed", async () => {
    const consumeNonce = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const attempt = () => authorizeSiwsNonce({ verifySignature: async () => true, consumeNonce });

    await expect(attempt()).resolves.toBeUndefined();
    await expect(attempt()).rejects.toThrow("already used nonce");
  });
});
