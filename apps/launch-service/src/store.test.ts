import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { PostgresLaunchStore } from "./store";

const databaseUrl = process.env.LAUNCH_TEST_DATABASE_URL;

test.skipIf(!databaseUrl).each([false, true])(
  "supports both launch formats and preserves existing runs (legacy database: %s)",
  async (legacy) => {
    const schema = `launch_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: databaseUrl });
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const store = new PostgresLaunchStore(url.toString());
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      if (legacy)
        await store.pool.query(await readFile(new URL("../migrations/0001_launch_runs.sql", import.meta.url), "utf8"));
      else await store.initialize();
      const blitz = await store.enqueue("game", { environment: "madara.blitz", gameName: "existing-blitz" });
      await store.initialize();
      const eternum = await store.enqueue("game", { environment: "madara.eternum", gameName: "new-eternum" });
      await store.initialize();
      expect((await store.find("game", "madara.blitz", blitz.name))?.id).toBe(blitz.id);
      expect((await store.list("madara.eternum")).map((run) => run.id)).toEqual([eternum.id]);
      expect(eternum.request.version).toBe("1");
      await expect(
        store.pool.query("UPDATE launch_runs SET environment = 'unsupported' WHERE id = $1", [eternum.id]),
      ).rejects.toThrow("launch_runs_environment_check");
    } finally {
      await store.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
