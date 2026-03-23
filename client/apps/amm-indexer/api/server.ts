import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/schema";
import { createAmmApiApp } from "./app";

const { Pool } = pg;

function createNodePgAmmApiApp() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
  });

  const db = drizzle(pool, { schema });
  return createAmmApiApp({
    db,
    lordsAddress: process.env.LORDS_ADDRESS ?? "",
  });
}

export const app = createNodePgAmmApiApp();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  serve({
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
  });

  console.log(`AMM Indexer API running on http://localhost:${process.env.PORT ?? 3000}`);
}
