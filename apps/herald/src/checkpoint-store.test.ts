import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Pool } from "pg";
import { expect, it } from "vitest";
import { CheckpointStore } from "./checkpoint-store";
import { receipt, rowEvent, setup } from "./native/fixtures";

const databaseUrl = process.env.HERALD_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("HERALD_TEST_DATABASE_URL is required for the PostgreSQL suite");

it("restores a PostgreSQL checkpoint, replays later facts and rejects retired models", async () => {
  const namespace = `checkpoint_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c search_path=${namespace}`);
  let store = new CheckpointStore(url.toString());
  try {
    await admin.query(`CREATE SCHEMA ${namespace}`);
    await store.initialize();
    const { native, decoder, fold } = setup();
    native.applyReceipt(fold, receipt([rowEvent("ResourceBalance", ["1", "7", "28"], ["100"])]), 10, 0);
    await store.save("madara", 10, fold);
    await store.close();
    store = new CheckpointStore(url.toString());
    const restored = await store.load("madara", decoder.registry);
    expect(restored?.confirmedBlock).toBe(10);
    expect(restored?.fold.snapshot("1", 10)).toEqual(fold.snapshot("1", 10));
    await native.replay({
      fold: restored!.fold,
      fromBlock: 11,
      toBlock: 11,
      rpc: {
        getBlockWithReceipts: async () => ({
          block_number: 11,
          timestamp: 121,
          transactions: [
            {
              receipt: receipt([rowEvent("ResourceBalance", ["1", "7", "28"], ["80"])]),
              transaction: { type: "INVOKE" },
            },
          ],
        }),
      },
    });
    expect(restored!.fold.gameRows("ResourceBalance", "1")[0].value.balance).toBe("0x50");
    const retired = fold.checkpoint();
    retired.models.push({ model: "QuestLevels", rows: [] });
    await admin.query(`UPDATE ${namespace}.herald_fold_checkpoints SET payload = $1`, [
      gzipSync(JSON.stringify(retired)),
    ]);
    expect(await store.load("madara", decoder.registry)).toBeUndefined();
  } finally {
    await store.close();
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    await admin.end();
  }
});
