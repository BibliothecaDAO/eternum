import { readFile } from "node:fs/promises";

export function deploymentIdentity(json: string, rpcUrl: string) {
  const { shard } = JSON.parse(json);
  const field = (value: unknown) =>
    typeof value === "string" && /^0x[0-9a-f]{1,64}$/i.test(value) && BigInt(value) > 0n;
  if (
    !shard ||
    ![
      shard.chainId,
      shard.accountClassHash,
      shard.guardianPublicKey,
      shard.vrfPublicKey?.x,
      shard.vrfPublicKey?.y,
    ].every(field) ||
    !/^0x[0-9a-f]{1,16}$/i.test(shard.l2GasBound ?? "") ||
    BigInt(shard.l2GasBound) === 0n
  )
    throw new Error("Incomplete pending shard identity");
  return {
    version: 1,
    chainId: shard.chainId,
    accountClassHash: shard.accountClassHash,
    guardianPublicKey: shard.guardianPublicKey,
    l2GasBound: shard.l2GasBound,
    vrfPublicKey: shard.vrfPublicKey,
    rpcUrl,
    contracts: {},
  };
}
/** Pending registration needs only the identity; the same listener serves the full world after init publishes it. */
export async function waitForWorldDocument(path: string, port: number, rpcUrl: string): Promise<void> {
  const complete = (json: string) => {
    const doc = JSON.parse(json);
    return !!doc.native && !!doc.world?.address;
  };
  let json = await readFile(path, "utf8");
  if (complete(json)) return;
  const identity = deploymentIdentity(json, rpcUrl);
  const server = Bun.serve({
    port,
    fetch(request) {
      if (request.method === "GET" && new URL(request.url).pathname === "/manifest") return Response.json(identity);
      return Response.json({ status: "pending_deployment" }, { status: 503 });
    },
  });
  try {
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      json = await readFile(path, "utf8");
      const current = deploymentIdentity(json, rpcUrl);
      if (JSON.stringify(current) !== JSON.stringify(identity))
        throw new Error("Shard identity changed during deployment");
      if (complete(json)) return;
    }
    throw new Error("Shard deployment did not publish its world");
  } finally {
    server.stop(true);
  }
}
