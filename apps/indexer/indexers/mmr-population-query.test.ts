import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MMR_HISTORY_CHECKPOINT_ID } from "@realms-world/db/schema";
const query = vi.hoisted(() => vi.fn());
vi.mock("@realms-world/db/client", () => ({ db: { execute: query } }));
import { readRatingPopulation, readRatingHistoryHead } from "../../web/src/lib/rating-population";
let client: PGlite;
beforeEach(async () => {
  client = new PGlite();
  await client.exec(`CREATE SCHEMA airfoil;
 CREATE TABLE airfoil.checkpoints(id text primary key,order_key int,unique_key text);
 CREATE TABLE starknet_mmr_updates(player text,block_number int,transaction_hash text,event_index int,new_mmr numeric);`);
  query.mockImplementation(async (statement) => {
    const q = new PgDialect().sqlToQuery(statement);
    return client.query(q.sql, q.params);
  });
});
afterEach(async () => client.close());
it("uses one snapshot's watermark and owners, without substituting stored rating values", async () => {
  await client.query("INSERT INTO airfoil.checkpoints VALUES ($1,77,'0xabc')", [MMR_HISTORY_CHECKPOINT_ID]);
  await client.exec(
    "INSERT INTO starknet_mmr_updates VALUES ('0xa',77,'tx1',0,1),('0xb',77,'tx1',1,2),('0xc',78,'tx2',0,9999)",
  );
  expect(await readRatingPopulation()).toEqual({ block_number: 77, block_hash: "0xabc", players: ["0xa", "0xb"] });
  expect(await readRatingHistoryHead()).toEqual({ block_number: 77, block_hash: "0xabc" });
});
it("does not confuse an empty processed history with no processed watermark", async () => {
  await expect(readRatingPopulation()).rejects.toThrow("watermark");
  await client.query("INSERT INTO airfoil.checkpoints VALUES ($1,77,'0xabc')", [MMR_HISTORY_CHECKPOINT_ID]);
  expect((await readRatingPopulation()).players).toEqual([]);
});
it("tracks a fork's rollback as a whole transaction and watermark", async () => {
  await client.query("INSERT INTO airfoil.checkpoints VALUES ($1,77,'0xabc')", [MMR_HISTORY_CHECKPOINT_ID]);
  await client.exec("INSERT INTO starknet_mmr_updates VALUES ('0xa',77,'tx1',0,1),('0xb',77,'tx1',1,2)");
  await client.transaction(async (tx) => {
    await tx.exec(
      "DELETE FROM starknet_mmr_updates WHERE transaction_hash='tx1'; UPDATE airfoil.checkpoints SET order_key=76,unique_key='0xdef'",
    );
  });
  expect(await readRatingPopulation()).toEqual({ block_number: 76, block_hash: "0xdef", players: [] });
});
