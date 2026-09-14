import { randomUUID } from "node:crypto";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { Pool } from "pg";

/** Applies the actual Drizzle declarations in an isolated schema of a disposable PostgreSQL database. */
export async function createNotificationTestDatabase(urlString: string, tables: Record<string, unknown>) {
  const admin = new Pool({ connectionString: urlString });
  const schema = `notification_test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(urlString);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: url.toString() });
  const close = async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  };
  try {
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY)');
    await pool.query(`INSERT INTO "user" VALUES ('0x1'), ('0x2')`);
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(tables));
    for (const statement of statements) await pool.query(statement.replaceAll('"public".', `"${schema}".`));
    return { pool, close };
  } catch (error) {
    await close();
    throw error;
  }
}
