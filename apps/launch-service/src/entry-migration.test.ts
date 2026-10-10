import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("never labels a completed Blitz opening free without its ledger provenance", async () => {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  try {
    const db = await mf.getD1Database("DB");
    await db.exec("CREATE TABLE launch_runs(kind TEXT,status TEXT,environment TEXT)");
    await db.batch([
      db.prepare("INSERT INTO launch_runs VALUES('game','complete','madara.blitz')"),
      db.prepare("INSERT INTO launch_runs VALUES('game','complete','madara.frontier')"),
    ]);
    const sql = readFileSync(new URL("../migrations/0007_game_entry.sql", import.meta.url), "utf8").replace(
      /^--.*$/gm,
      "",
    );
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
    expect(
      await db.prepare("SELECT entry FROM launch_runs WHERE environment='madara.blitz'").first("entry"),
    ).toBeNull();
    expect(await db.prepare("SELECT entry FROM launch_runs WHERE environment='madara.frontier'").first("entry")).toBe(
      '{"kind":"free"}',
    );
    await db.prepare("UPDATE launch_runs SET entry=? WHERE environment='madara.blitz'").bind('{"kind":"free"}').run();
    const repair = readFileSync(
      new URL("../migrations/0008_unproven_blitz_entries.sql", import.meta.url),
      "utf8",
    ).replace(/^--.*$/gm, "");
    await db.batch(
      repair
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
    expect(
      await db.prepare("SELECT entry FROM launch_runs WHERE environment='madara.blitz'").first("entry"),
    ).toBeNull();
  } finally {
    await mf.dispose();
  }
});
