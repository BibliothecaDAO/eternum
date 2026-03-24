import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/schema";
import { createAmmApiApp } from "../api/app";
import { ensureAmmDatabaseSchema } from "../src/preview/schema";
import { DEFAULT_STANDALONE_AMM_LORDS_ADDRESS, seedStandalonePreviewDatabase } from "../src/preview/standalone-preview";

const { Pool } = pg;

async function runStandalonePreviewApi() {
  const connectionString =
    process.env.POSTGRES_CONNECTION_STRING ?? "postgresql://postgres:postgres@127.0.0.1:54329/amm_preview";
  const port = Number(process.env.PORT ?? 3001);
  const pool = new Pool({
    connectionString,
  });

  await ensureAmmDatabaseSchema((statement) => pool.query(statement));
  const db = drizzle(pool, { schema });
  await seedStandalonePreviewDatabase({ db });

  const app = createAmmApiApp({
    db,
    lordsAddress: DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
  });

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`AMM preview API running on http://127.0.0.1:${port}`);
}

await runStandalonePreviewApi();
