import { readdirSync, readFileSync } from "node:fs";
import { Miniflare } from "miniflare";

/** A D1 database in workerd with the launch migrations applied, as `wrangler d1 migrations apply` would. */
export async function createLaunchTestDatabase() {
  const mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.batch(migrationStatements().map((statement) => db.prepare(statement)));
  return { db, close: () => mf.dispose() };
}

const migrationStatements = (): string[] => {
  const migrations = new URL("../migrations/", import.meta.url);
  return readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
};
