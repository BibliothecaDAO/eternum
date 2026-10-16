import { readFileSync } from "node:fs";

/** The node's memory as the shard's metrics collector last sampled it (deploy/athanor/metrics/collect_cpu.py). */
export interface NodeHealth {
  sampled_at: number;
  /** Null while no node runs in its slice. */
  memory_bytes: number | null;
  host_memory_bytes: number;
}

/** Where compose mounts the collector's data directory, read-only. */
export const NODE_HEALTH_FILE = "/metrics/node-health.json";

/** The collector's last sample, or null when there is none to read: unknown, never healthy. */
export function readNodeHealth(path: string): NodeHealth | null {
  let sample: Partial<NodeHealth>;
  try {
    sample = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
  if (!count(sample.sampled_at) || !count(sample.host_memory_bytes)) return null;
  if (sample.memory_bytes !== null && !count(sample.memory_bytes)) return null;
  return {
    sampled_at: sample.sampled_at!,
    memory_bytes: sample.memory_bytes ?? null,
    host_memory_bytes: sample.host_memory_bytes!,
  };
}
