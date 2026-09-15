import { createHash } from "node:crypto";

/** Load the decoder and fold from the selected checkout, using the same immutable block range. */
export async function replayDojo(source: string, manifestPath: string, through: number) {
  const { createModelRegistry, readWorldManifest } = await import(`${source}/apps/herald/src/model-registry.ts`);
  const { MadaraRpc } = await import(`${source}/apps/herald/src/madara-rpc.ts`);
  const { buildWorldFold } = await import(`${source}/apps/herald/src/snapshot-builder.ts`);
  const { WorldEventDecodeMonitor } = await import(`${source}/apps/herald/src/world-event-decoder.ts`);
  const registry = createModelRegistry(await readWorldManifest(manifestPath));
  const monitor = new WorldEventDecodeMonitor();
  const result = await buildWorldFold({
    registry,
    rpc: new MadaraRpc("http://127.0.0.1:5050/rpc/v0_10_2"),
    confirmedBlock: through,
    decodeMonitor: monitor,
  });
  if (monitor.failures !== 0) throw new Error("Dojo replay contains undecodable events");
  return {
    world: registry.worldAddress,
    confirmedBlock: result.confirmedBlock,
    sha256: createHash("sha256").update(JSON.stringify(result.fold.checkpoint())).digest("hex"),
    failures: monitor.failures,
    metrics: result.metrics,
  };
}
