import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { expect, it } from "vitest";

it("persists confirmed obligations, cursor and halt across actual Worker restarts", async () => {
  const root = mkdtempSync(join(tmpdir(), "value-relay-state-"));
  const entry = join(root, "state-worker.ts");
  const config = join(root, "wrangler.json");
  const bundle = join(root, "bundle");
  writeFileSync(
    entry,
    `
    import { DurableObject } from 'cloudflare:workers';
    import { DurableRelayStore } from ${JSON.stringify(new URL("./state.ts", import.meta.url).pathname)};
    import { DurableChestStore } from ${JSON.stringify(new URL("./chests.ts", import.meta.url).pathname)};
    export class StateTest extends DurableObject {
      store = new DurableRelayStore(this.ctx.storage);
      chests = new DurableChestStore(this.ctx.storage);
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/observe') await this.store.observe(await request.json());
        if (path === '/halt') await this.store.halt('confirmed_block_changed:0');
        if (path === '/observe-chests') await this.chests.observe(await request.json());
        if (path === '/complete-chest') await this.chests.complete('7');
        if (path === '/complete') await this.store.completeWithdrawal('0xabc');
        return Response.json({ progress: await this.store.progress(), withdrawals: await this.store.withdrawals(), results: await this.store.results(), chestCursor: await this.chests.cursor(), chests: await this.chests.pending() });
      }
    }
    export default { fetch: (request, env) => env.TEST.get(env.TEST.idFromName('chain')).fetch(request) };
  `,
  );
  writeFileSync(
    config,
    JSON.stringify({
      name: "state-test",
      main: entry,
      compatibility_date: "2026-07-30",
      migrations: [{ tag: "v1", new_sqlite_classes: ["StateTest"] }],
      durable_objects: { bindings: [{ name: "TEST", class_name: "StateTest" }] },
    }),
  );
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--config", config, "--outdir", bundle], {
    stdio: "ignore",
  });
  const start = () =>
    new Miniflare({
      modulesRoot: bundle,
      modules: [{ type: "ESModule", path: join(bundle, "state-worker.js") }],
      compatibilityDate: "2026-07-30",
      durableObjects: { TEST: { className: "StateTest", useSQLite: true } },
      durableObjectsPersist: join(root, "storage"),
    });
  const withdrawal = {
    chainId: "0x1",
    seasonId: 1,
    transactionHash: "0xabc",
    realmsId: "0x2",
    amount: "17",
    confirmedAt: 1000,
  };
  const block = {
    chainId: "0x1",
    number: 0,
    hash: "0xa",
    parentHash: "0x0",
    status: "ACCEPTED_ON_L2",
    withdrawals: [withdrawal],
    results: [],
  };
  let worker = start();
  try {
    await worker.dispatchFetch("https://state.test/observe", { method: "POST", body: JSON.stringify(block) });
    const chest = { tokenId: "7", requester: "0x123", requestBlock: 100 };
    await worker.dispatchFetch("https://state.test/observe-chests", {
      method: "POST",
      body: JSON.stringify({ head: 110, next: null, rows: [{ kind: "requested", request: chest }] }),
    });
    await worker.dispose();
    worker = start();
    expect(await (await worker.dispatchFetch("https://state.test/read")).json()).toEqual({
      progress: { nextBlock: 1, lastHash: "0xa", halted: null },
      withdrawals: [withdrawal],
      results: [],
      chestCursor: { fromBlock: 111 },
      chests: [chest],
    });
    await worker.dispatchFetch("https://state.test/halt");
    await worker.dispose();
    worker = start();
    expect(await (await worker.dispatchFetch("https://state.test/read")).json()).toMatchObject({
      progress: { halted: "confirmed_block_changed:0" },
    });
    await worker.dispatchFetch("https://state.test/complete");
    expect(await (await worker.dispatchFetch("https://state.test/read")).json()).toMatchObject({ withdrawals: [] });
  } finally {
    await worker.dispose();
  }
}, 30_000);
