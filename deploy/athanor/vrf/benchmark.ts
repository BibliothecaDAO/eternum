import { readFileSync } from "node:fs";
import { hash } from "starknet";
import { startStampPool, workerCount } from "./pool";
import type { PlayIdentity, PlayInvoke } from "./transaction";

async function benchmark() {
  const manifestPath = process.env.NATIVE_WORLD_MANIFEST,
    keyFile = process.env.VRF_KEY_FILE;
  if (!manifestPath || !keyFile) throw new Error("Manifest and protected key file are required");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const identity: PlayIdentity = { ...manifest.shard, games: manifest.world.address };
  const count = workerCount(process.env.VRF_WORKERS);
  const pool = await startStampPool(keyFile, identity, count);
  const zero = { max_amount: "0x0", max_price_per_unit: "0x0" };
  const tx: PlayInvoke = {
    type: "INVOKE",
    version: "0x3",
    sender_address: "0x123",
    nonce: "0x0",
    tip: "0x0",
    signature: ["0x1", "0x2", "0x3"],
    calldata: ["0x1", identity.games, hash.getSelectorFromName("play"), "0x5", "0x1", "0x1", "0x123", "0x1", "0x0"],
    resource_bounds: {
      l1_gas: zero,
      l1_data_gas: zero,
      l2_gas: { max_amount: identity.l2GasBound, max_price_per_unit: "0x0" },
    },
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  try {
    await pool.stamp(tx);
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      await Promise.all(
        Array.from({ length: 2000 }, (_, i) => pool.stamp({ ...tx, sender_address: `0x${(0x123 + i).toString(16)}` })),
      );
      const milliseconds = performance.now() - start;
      console.log(
        JSON.stringify({ workers: count, transactions: 2000, run, milliseconds, passes500ms: milliseconds < 500 }),
      );
    }
  } finally {
    pool.close();
  }
}
if (import.meta.main)
  benchmark().catch(() => {
    console.error("VRF benchmark failed");
    process.exitCode = 1;
  });
