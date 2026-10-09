import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ec } from "starknet";
import { Miniflare } from "miniflare";
import { expect, it } from "vitest";

it("offers direct readonly readiness without exposing signing over HTTP", async () => {
  const bundle = join(mkdtempSync(join(tmpdir(), "guardian-health-")), "bundle");
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
    const health = await worker.dispatchFetch("https://guardian.public.test/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(await health.json()).toEqual({
      service: "realms-guardian",
      success: true,
      publicKey: ec.starkCurve.getStarkKey(privateKey),
    });
    for (const path of ["/signDeviceChange", "/publicKey", "/"])
      expect((await worker.dispatchFetch(`https://guardian.public.test${path}`)).status).toBe(404);
    expect((await worker.dispatchFetch("https://guardian.public.test/health", { method: "POST" })).status).toBe(404);
    await worker.dispose();
    worker = start("invalid");
    const failed = await worker.dispatchFetch("https://guardian.public.test/health");
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ service: "realms-guardian", success: false });
  } finally {
    await worker.dispose();
  }
}, 30000);
