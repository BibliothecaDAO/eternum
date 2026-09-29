import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { buildWorkerBundle, migrationStatements, newStorage, startWorker, vapidKeys } from "./workerd-harness";

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
  const response = await worker.mf.dispatchFetch("https://staging.realms.party/api/directory");

  expect(response.status).toBe(200);
  expect(launchDirectoryMock).toHaveBeenCalledOnce();
  expect(launchDirectoryMock.mock.calls[0]?.[0].url).toBe("https://launch/api/factory/directory-games");
});
