import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/schema";
import { ensureAmmDatabaseSchema } from "../src/preview/schema";

export async function createTestAmmDatabase() {
  const client = new PGlite();
  await ensureAmmDatabaseSchema((statement) => client.exec(statement));

  return {
    db: drizzle(client, { schema }),
    async close() {
      await client.close();
    },
  };
}
