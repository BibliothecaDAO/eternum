import { afterEach, expect, it, vi } from "vitest";

import type { PreparedTerrainPage, TerrainPageRequest } from "./terrain-types";

class FakeWorker extends EventTarget {
  static made = 0;
  readonly posted: Array<{ id: number }> = [];
  terminated = false;
  constructor() {
    super();
    FakeWorker.made += 1;
  }
  postMessage(message: { id: number }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  answer(id: number) {
    const page = { pageKey: `page-${id}` } as unknown as PreparedTerrainPage;
    this.dispatchEvent(new MessageEvent("message", { data: { id, kind: "terrain-page", page } }));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  FakeWorker.made = 0;
});

it("builds every terrain's pages on one worker, and a terrain that leaves drops only its own pages", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const { TerrainPageWorkerClient } = await import("./terrain-page-worker-client");
  const map = new TerrainPageWorkerClient();
  const realm = new TerrainPageWorkerClient();
  expect(FakeWorker.made).toBe(1);

  const request = {} as TerrainPageRequest;
  const mapPage = map.prepare(request);
  const realmPage = realm.prepare(request);
  const worker = (map as unknown as { worker: FakeWorker }).worker;
  const [mapId, realmId] = worker.posted.map(({ id }) => id);
  expect(mapId).not.toBe(realmId);

  realm.dispose();
  await expect(realmPage).rejects.toThrow("disposed");
  expect(worker.terminated).toBe(false);

  worker.answer(realmId);
  worker.answer(mapId);
  await expect(mapPage).resolves.toEqual({ pageKey: `page-${mapId}` });
});
