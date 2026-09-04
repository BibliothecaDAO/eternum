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

  it("refuses a sequential replay after the nonce is consumed", async () => {
    const consumeNonce = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const attempt = () => authorizeSiwsNonce({ verifySignature: async () => true, consumeNonce });

    await expect(attempt()).resolves.toBeUndefined();
    await expect(attempt()).rejects.toThrow("already used nonce");
  });
});

describe.runIf(Boolean(process.env.DATABASE_URL))("SIWS nonce database consumption", () => {
  it("allows exactly one concurrent DELETE RETURNING to consume a nonce", async () => {
    const [{ db }, { verification }, { consumeSiwsNonce }] = await Promise.all([
      import("@realms-world/db/client"),
      import("@realms-world/db"),
      import("./auth-siws-plugin"),
    ]);
    const id = `siws-concurrency-${crypto.randomUUID()}`;
    await db.insert(verification).values({
      id,
      identifier: id,
      value: "nonce",
      expiresAt: new Date(Date.now() + 60_000),
    });

    try {
      const results = await Promise.all([consumeSiwsNonce(id), consumeSiwsNonce(id)]);
      expect(results.sort()).toEqual([false, true]);
    } finally {
      const { eq } = await import("@realms-world/db");
      await db.delete(verification).where(eq(verification.id, id));
    }
  });
});
