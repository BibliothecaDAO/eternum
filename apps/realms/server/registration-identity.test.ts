import { expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { registrationRealmsId } from "./registration-identity";
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
    expect(await registrationRealmsId(db, "0x01", 9)).toBe("old-id");
    expect(await registrationRealmsId(db, "0x1", 10)).toBe("new-id");
    expect(await registrationRealmsId(db, "0x1", 0)).toBeNull();
    expect(await registrationRealmsId(db, "0x2", 20)).toBeNull();
  } finally {
    await mf.dispose();
  }
});
