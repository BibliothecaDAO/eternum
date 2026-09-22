import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PostgresLaunchStore } from "./store";

export async function createLaunchTestStore() {
  const databaseUrl = process.env.LAUNCH_TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("LAUNCH_TEST_DATABASE_URL is required for the PostgreSQL suite");
  const schema = `launch_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const store = new PostgresLaunchStore(url.toString());
  const close = async () => {
    await store.close();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await store.initialize();
    return { store, close };
  } catch (error) {
    await close();
    throw error;
  }
}
