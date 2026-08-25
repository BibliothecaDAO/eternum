import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/schema";
import { createAmmV2ApiApp } from "../api/app";
import { createAmmV2DatabasePool, resolveAmmV2PreviewDatabaseConnectionString } from "../src/database-connection";
import { ensureAmmV2DatabaseSchema } from "../src/database-schema";
import { seedStandalonePreviewDatabase } from "../src/preview/standalone-preview";

async function runStandalonePreviewApi() {
  const connectionString = resolveAmmV2PreviewDatabaseConnectionString(process.env.POSTGRES_CONNECTION_STRING);
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  const pool = createAmmV2DatabasePool(connectionString);

  await ensureAmmV2DatabaseSchema((statement) => pool.query(statement));
  const db = drizzle(pool, { schema });
  await seedStandalonePreviewDatabase({ db });

  const app = createAmmV2ApiApp({ db });

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`AMMv2 preview API running on http://127.0.0.1:${port}`);
}

await runStandalonePreviewApi();
