import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { execFileSync } from "node:child_process";
import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "guardian-health-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

it("exposes no operation over HTTP, including the former health path", async () => {
  const bundle = join(root, "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    stdio: "ignore",
  });
  const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const start = (key: string) =>
    new Miniflare({
      modulesRoot: bundle,
      modules: [{ type: "ESModule", path: join(bundle, "worker.js") }],
      compatibilityDate: "2026-07-30",
      bindings: { GUARDIAN_PRIVATE_KEY: key },
    });
  let worker = start(privateKey);
  try {
    for (const path of ["/health", "/signDeviceChange", "/publicKey", "/"])
      expect((await worker.dispatchFetch(`https://guardian.public.test${path}`)).status).toBe(404);
    expect((await worker.dispatchFetch("https://guardian.public.test/health", { method: "POST" })).status).toBe(404);
    await disposeWorker(worker);
    worker = start("invalid");
    const failed = await worker.dispatchFetch("https://guardian.public.test/health");
    expect(failed.status).toBe(404);
  } finally {
    await disposeWorker(worker);
  }
}, 30000);
