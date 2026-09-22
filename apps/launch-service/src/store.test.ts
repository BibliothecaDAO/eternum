import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { scheduleFrontierSeason } from "./schedule";
import { PostgresLaunchStore } from "./store";

const databaseUrl = process.env.LAUNCH_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("LAUNCH_TEST_DATABASE_URL is required for the PostgreSQL suite");

test.each([false, true])(
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
      expect("version" in eternum.request && eternum.request.version).toBe("3");
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

test("creation and delayed finalization are one durable transaction and survive reconnect", async () => {
  const schema = `result_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const store = new PostgresLaunchStore(url.toString());
  const reconnected = new PostgresLaunchStore(url.toString());
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await store.initialize();
    const queued = await store.enqueue("game", { environment: "madara.blitz", gameName: "native-results" });
    const claimed = (await store.claim(60_000))!;
    const summary = {
      environment: "madara.blitz" as const,
      chain: "madara" as const,
      gameType: "blitz" as const,
      gameName: queued.name,
      gameId: 7,
      startTime: 100,
      startTimeIso: "1970-01-01T00:01:40Z",
      rpcUrl: "http://rpc.test",
      configMode: "batched" as const,
      configSteps: [],
      dryRun: false,
      finalizeAt: Math.floor(Date.now() / 1_000) + 3_600,
    };
    await expect(store.complete(claimed.id, "00000000-0000-0000-0000-000000000000", summary)).rejects.toThrow("lease");
    expect(await store.find("result", "madara.blitz", queued.name)).toBeNull();
    await expect(store.complete(claimed.id, claimed.leaseToken, { ...summary, finalizeAt: undefined })).rejects.toThrow(
      "schedule",
    );
    expect((await store.find("game", "madara.blitz", queued.name))?.status).toBe("running");
    await store.complete(claimed.id, claimed.leaseToken, summary);
    await store.close();
    await reconnected.initialize();
    expect((await reconnected.find("result", "madara.blitz", queued.name))?.request).toEqual({
      environment: "madara.blitz",
      gameName: queued.name,
      gameId: 7,
    });
    expect(await reconnected.claim(60_000)).toBeNull();
    await reconnected.pool.query("UPDATE launch_runs SET available_at = now() WHERE kind = 'result'");
    const result = (await reconnected.claim(60_000))!;
    expect(result.kind).toBe("result");
    await reconnected.retry(result.id, result.leaseToken, "interrupted", 0);
    const recovered = (await reconnected.claim(60_000))!;
    expect(recovered.id).toBe(result.id);
    await reconnected.complete(recovered.id, recovered.leaseToken, {
      environment: "madara.blitz",
      gameName: queued.name,
      gameId: 7,
      resultCommitment: "0x123",
    });
    expect(await reconnected.claim(60_000)).toBeNull();
    expect(await reconnected.list("madara.blitz")).toHaveLength(2);
  } finally {
    if (!store.pool.ended) await store.close();
    await reconnected.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

test("one Frontier season launch survives reconnects and duplicate scheduling", async () => {
  const schema = "frontier_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", "-c search_path=" + schema);
  let store = new PostgresLaunchStore(url.toString());
  const seasonStart = "2027-01-01T00:00:00.000Z";
  try {
    await admin.query("CREATE SCHEMA " + schema);
    await store.initialize();
    const queued = await scheduleFrontierSeason(store, seasonStart);
    expect(queued.name).toBe("frontier-1798761600");
    await store.close();
    store = new PostgresLaunchStore(url.toString());
    await store.initialize();
    // Scheduling again before the run is claimed queues the same season once more, under the same name.
    const rescheduled = await scheduleFrontierSeason(store, seasonStart);
    expect(rescheduled).toMatchObject({ name: queued.name, status: "queued" });
    expect(await store.list("madara.frontier")).toHaveLength(1);
    const run = (await store.claim(60_000))!;
    expect(run.id).toBe(rescheduled.id);
    expect(run.request).toMatchObject({ version: "1", gameStartTime: seasonStart });
    // A restart while the run is still leased must find the same run, not queue a second season.
    await store.close();
    store = new PostgresLaunchStore(url.toString());
    await store.initialize();
    expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ id: run.id, status: "running" });
    expect(await store.claim(60_000)).toBeNull();
    await store.complete(run.id, run.leaseToken, {
      environment: "madara.frontier",
      chain: "madara",
      gameType: "frontier",
      gameName: run.name,
      gameId: 9,
      startTime: Date.parse(seasonStart) / 1000,
      startTimeIso: seasonStart,
      rpcUrl: "http://rpc.test",
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    });
    await store.close();
    store = new PostgresLaunchStore(url.toString());
    await store.initialize();
    expect(await scheduleFrontierSeason(store, seasonStart)).toMatchObject({ id: run.id, status: "complete" });
    await store.pool.query("UPDATE launch_runs SET status = 'failed', error_message = 'rpc down' WHERE id = $1", [
      run.id,
    ]);
    const requeued = await scheduleFrontierSeason(store, seasonStart);
    expect(requeued).toMatchObject({ name: queued.name, status: "queued", attempts: 0 });
    expect(requeued.errorMessage).toBeUndefined();
    const retried = (await store.claim(60_000))!;
    expect(retried.name).toBe(queued.name);
    await store.complete(retried.id, retried.leaseToken, {
      environment: "madara.frontier",
      chain: "madara",
      gameType: "frontier",
      gameName: retried.name,
      gameId: 9,
      startTime: Date.parse(seasonStart) / 1000,
      startTimeIso: seasonStart,
      rpcUrl: "http://rpc.test",
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    });
    expect(await store.claim(60_000)).toBeNull();
    expect(await store.list("madara.frontier")).toHaveLength(1);
    const next = await scheduleFrontierSeason(store, "2027-04-30T00:00:00.000Z");
    expect(next.id).not.toBe(queued.id);
    expect((await store.claim(60_000))?.id).toBe(next.id);
  } finally {
    await store.close();
    await admin.query("DROP SCHEMA " + schema + " CASCADE");
    await admin.end();
  }
});
