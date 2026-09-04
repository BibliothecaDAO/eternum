import { ensureAmmV2DatabaseSchema } from "../src/database-schema";
import { createAmmV2DatabasePool, resolveAmmV2DatabaseConnectionString } from "../src/database-connection";

async function runDatabaseSchemaInitialization() {
  const connectionString = resolveAmmV2DatabaseConnectionString(process.env.POSTGRES_CONNECTION_STRING);
  const pool = createAmmV2DatabasePool(connectionString);

  try {
    await ensureAmmV2DatabaseSchema((statement) => pool.query(statement));
  } finally {
    await pool.end();
  }

  console.log("AMMv2 database schema is ready");
}

await runDatabaseSchemaInitialization();
