import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { buildWorkerBundle, migrationStatements, newStorage, ORIGIN, startWorker, vapidKeys } from "./workerd-harness";

let bundle: string;
let worker: Awaited<ReturnType<typeof startWorker>>;

beforeAll(async () => {
  bundle = buildWorkerBundle();
  const launchDirectory = vi.fn(async () => Response.json({ chains: [] }));
  worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: async () => new Response("unexpected outbound request", { status: 500 }),
    launchDirectory,
  });
  await worker.db.batch(migrationStatements().map((sql) => worker.db.prepare(sql)));
  launchDirectoryMock = launchDirectory;
}, 180_000);

afterAll(() => worker?.dispose());

let launchDirectoryMock: ReturnType<typeof vi.fn>;

it("routes the directory read through the launch service binding", async () => {
  const response = await worker.mf.dispatchFetch(`${ORIGIN}/api/directory`);

  expect(response.status).toBe(200);
  expect(launchDirectoryMock).toHaveBeenCalledOnce();
  expect(launchDirectoryMock.mock.calls[0]?.[0].url).toBe("https://launch/api/factory/directory-games");
});

it("serves health and email sign-in while the chain is unreachable, and the top list says it is unavailable", async () => {
  expect((await worker.mf.dispatchFetch(`${ORIGIN}/api/health`)).status).toBe(200);
  expect(await (await worker.mf.dispatchFetch(`${ORIGIN}/api/auth/providers`)).json()).toEqual({ providers: [] });
  const player = await worker.signInWithEmailCode("no-chain@realms.test");
  expect(player.realmsId).toMatch(/^0x/);
  const top = await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top`);
  expect(top.status).toBe(503);
  expect(await top.json()).toEqual({ error: "ratings_unavailable" });
});
