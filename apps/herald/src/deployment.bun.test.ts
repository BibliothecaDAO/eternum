import { expect, test } from "bun:test";
import { deploymentIdentity } from "./deployment";
const shard = {
  chainId: "0x1",
  accountClassHash: "0x2",
  guardianPublicKey: "0x3",
  l2GasBound: "0x47868c00",
  vrfPublicKey: { x: "0x4", y: "0x5" },
};
test("pending manifest serves only the real initialized identity, never a placeholder world", () => {
  const manifest = deploymentIdentity(JSON.stringify({ shard }), "https://rpc.test");
  expect(manifest.contracts).toEqual({});
  expect(manifest.l2GasBound).toBe(shard.l2GasBound);
  expect(manifest.vrfPublicKey).toEqual(shard.vrfPublicKey);
  for (const field of Object.keys(shard))
    expect(() =>
      deploymentIdentity(JSON.stringify({ shard: { ...shard, [field]: undefined } }), "https://rpc.test"),
    ).toThrow();
});

import { mkdtemp, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForWorldDocument } from "./deployment";

test("one listener serves pending identity until atomic world publication, then releases its port", async () => {
  const directory = await mkdtemp(join(tmpdir(), "herald-deployment-"));
  const path = join(directory, "native-world.json");
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = reservation.port!;
  reservation.stop(true);
  await writeFile(path, JSON.stringify({ shard }));
  const boot = waitForWorldDocument(path, port, "https://rpc.test");
  try {
    let response: Response | undefined;
    for (let i = 0; i < 100 && !response; i++) {
      response = await fetch(`http://127.0.0.1:${port}/manifest`).catch(() => undefined);
      if (!response) await Bun.sleep(10);
    }
    expect(response?.status).toBe(200);
    expect(await response!.json()).toMatchObject({
      chainId: shard.chainId,
      l2GasBound: shard.l2GasBound,
      contracts: {},
    });
    expect((await fetch(`http://127.0.0.1:${port}/games`)).status).toBe(503);
    await writeFile(path + ".tmp", JSON.stringify({ shard, native: { version: 2 }, world: { address: "0x6" } }));
    await rename(path + ".tmp", path);
    await boot;
    const full = Bun.serve({ port, fetch: () => Response.json({ ready: true }) });
    try {
      expect((await fetch(`http://127.0.0.1:${port}/games`)).status).toBe(200);
    } finally {
      full.stop(true);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
