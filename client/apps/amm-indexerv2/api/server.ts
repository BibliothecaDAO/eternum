import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { createAmmV2DatabasePool, resolveAmmV2DatabaseConnectionString } from "../src/database-connection";
import * as schema from "../src/schema";
import { createAmmV2ApiApp } from "./app";

function createNodePgAmmV2ApiApp() {
  const connectionString = resolveAmmV2DatabaseConnectionString(process.env.POSTGRES_CONNECTION_STRING);
  const pool = createAmmV2DatabasePool(connectionString);
  const db = drizzle(pool, { schema });

  return createAmmV2ApiApp({
    db,
    allowedOrigins: resolveAllowedBrowserOrigins(process.env.AMMV2_API_ALLOWED_ORIGINS),
  });
}

function resolveAllowedBrowserOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export const app = createNodePgAmmV2ApiApp();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`AMMv2 Indexer API running on http://localhost:${port}`);
}
