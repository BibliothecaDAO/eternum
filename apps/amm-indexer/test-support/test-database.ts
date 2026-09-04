import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";
import { ensureAmmV2DatabaseSchema } from "../src/database-schema";

export async function createTestAmmV2Database() {
  const client = new PGlite();
  await ensureAmmV2DatabaseSchema((statement) => client.exec(statement));

  return {
    db: drizzle(client, { schema }),
    async close() {
      await client.close();
    },
  };
}
