import { expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { registrationRealmsIds } from "./registration-identity";
it("resolves the link at registration, including relinks and exact replacement boundaries", async () => {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  try {
    const db = (await mf.getD1Database("DB")) as unknown as D1Database;
    await db
      .prepare("CREATE TABLE wallet_link_history (wallet TEXT, account TEXT, linked_at INTEGER, replaced_at INTEGER)")
      .run();
    await db.batch([
      db
        .prepare("INSERT INTO wallet_link_history VALUES (?, 'old-id', 1000, 10000)")
        .bind(normalizeStarknetAddress("0x1")),
      db
        .prepare("INSERT INTO wallet_link_history VALUES (?, 'new-id', 10000, NULL)")
        .bind(normalizeStarknetAddress("0x1")),
    ]);
    expect(await registrationRealmsIds(db, [{ wallet: "0x01", registeredAt: 9 }])).toEqual(["old-id"]);
    expect(await registrationRealmsIds(db, [{ wallet: "0x1", registeredAt: 10 }])).toEqual(["new-id"]);
    expect(await registrationRealmsIds(db, [{ wallet: "0x1", registeredAt: 0 }])).toEqual([null]);
    expect(await registrationRealmsIds(db, [{ wallet: "0x2", registeredAt: 20 }])).toEqual([null]);
    await db.prepare("UPDATE wallet_link_history SET replaced_at=11000 WHERE account='old-id'").run();
    expect(await registrationRealmsIds(db, [{ wallet: "0x1", registeredAt: 10 }])).toEqual(["new-id"]);
    expect(
      await registrationRealmsIds(db, [
        { wallet: "0x2", registeredAt: 20 },
        { wallet: "0x1", registeredAt: 9 },
        { wallet: "0x01", registeredAt: 10 },
      ]),
    ).toEqual([null, "old-id", "new-id"]);
    await expect(
      registrationRealmsIds(
        db,
        Array.from({ length: 101 }, () => ({ wallet: "0x1", registeredAt: 10 })),
      ),
    ).rejects.toThrow("page_too_large");
    await expect(registrationRealmsIds(db, [{ wallet: "0x1", registeredAt: -1 }])).rejects.toThrow(
      "invalid_registration_time",
    );
  } finally {
    await mf.dispose();
  }
});
