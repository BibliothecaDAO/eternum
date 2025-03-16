import { DuneClient } from "@duneanalytics/client-sdk";
import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";

import { db } from "@realms-world/db/client";
import { velords_burns, velords_supply } from "@realms-world/db/schema";

const { VITE_DUNE_API_KEY } = process.env;
const client = new DuneClient(VITE_DUNE_API_KEY ?? "");
export const config = {
  cron: "0 */6 * * *",
};

export const APIRoute = createAPIFileRoute("/api/dune")({
  GET: async () => {
    console.log("Fetching data from Dune");
    const queryID = 4101280;
    const supplyQueryID = 4101108;

    try {
      const executionResult = await client.getLatestResult({
        queryId: queryID,
      });
      const supplyResult = await client.getLatestResult({
        queryId: supplyQueryID,
      });

      if (executionResult.result?.rows) {
        // Filter and transform the rows to match schema
        const filteredRows = executionResult.result.rows.map(
          (row: Record<string, unknown>) => ({
            source: row.Name as string,
            amount: row.amount as string,
            transaction_hash: row.transaction_hash as string,
            epoch: new Date(row.epoch),
            epoch_total_amount: row.epoch_total_amount as string,
            sender_epoch_total_amount: row.sender_epoch_total_amount as string,
          }),
        ) satisfies (typeof velords_burns.$inferInsert)[];

        try {
          const burnsResult = await db
            .insert(velords_burns)
            .values(filteredRows)
            .onConflictDoNothing()
            .returning({
              source: velords_burns.source,
              amount: velords_burns.amount,
            });
          return json({
            burns: burnsResult,
          });
        } catch (e) {
          console.log("Error inserting burns:", e);
        }
      }

      if (supplyResult.result?.rows) {
        const supplyRows = supplyResult.result.rows.map(
          (row: Record<string, unknown>) => ({
            old_supply: row.old_supply as string,
            new_supply: row.new_supply as string,
            transaction_hash: row.transaction_hash as string,
            block_time: new Date(row.block_time as string),
          }),
        ) satisfies (typeof velords_supply.$inferInsert)[];
        console.log(supplyRows);
        try {
          const supplyInsertResult = await db
            .insert(velords_supply)
            .values(supplyRows)
            .onConflictDoNothing()
            .returning({
              new_supply: velords_supply.new_supply,
              transaction_hash: velords_supply.transaction_hash,
            });
          return json({
            supply: supplyInsertResult,
          });
        } catch (e) {
          console.log("Error inserting supply:", e);
        }
      }
      return json({
        result: "none",
      });
    } catch (error) {
      console.error(error);
      return new Response("Error fetching data from Dune", { status: 500 });
    }
  },
});
