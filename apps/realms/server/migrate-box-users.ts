/**
 * The one-time move of Realms users from the box's Postgres into an identity D1 database: every user with their
 * linked wallet, name and portrait, each given the Realms id its user id derives. Sessions are not moved; players sign
 * in again. The move fails unless the target then holds exactly as many users as the source.
 *
 *   DATABASE_URL=postgres://… bun server/migrate-box-users.ts staging
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

import { realmsIdOf } from "./realms-id";

interface BoxUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  created_at: Date;
  updated_at: Date;
  address: string | null;
}

const sqlText = (value: string | null) => (value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`);

const insertUser = (user: BoxUser) =>
  `INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "address", "realmsId") VALUES (${[
    sqlText(user.id),
    sqlText(user.name),
    sqlText(user.email),
    user.email_verified ? "1" : "0",
    sqlText(user.image),
    sqlText(user.created_at.toISOString()),
    sqlText(user.updated_at.toISOString()),
    sqlText(user.address),
    sqlText(realmsIdOf(user.id)),
  ].join(", ")});`;

const readBoxUsers = async (databaseUrl: string): Promise<BoxUser[]> => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<BoxUser>(
      'SELECT id, name, email, email_verified, image, created_at, updated_at, address FROM "user" ORDER BY created_at',
    );
    return rows;
  } finally {
    await client.end();
  }
};

/** Runs wrangler's D1 command against the environment's remote database and returns its JSON result. */
const d1 = (environment: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(
      "pnpm",
      ["exec", "wrangler", "d1", "execute", "DB", "--env", environment, "--remote", "--json", ...args],
      {
        cwd: new URL("..", import.meta.url).pathname,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      },
    ),
  ) as { results: Record<string, unknown>[] }[];

const importUsers = (environment: string, users: BoxUser[]) => {
  const directory = mkdtempSync(join(tmpdir(), "identity-users-"));
  try {
    const file = join(directory, "users.sql");
    writeFileSync(file, users.map(insertUser).join("\n"));
    d1(environment, "--file", file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const targetUserCount = (environment: string) =>
  Number(d1(environment, "--command", 'SELECT count(*) AS "users" FROM "user"')[0]?.results[0]?.users);

const environment = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (environment !== "staging" && environment !== "production")
  throw new Error("name the environment: staging or production");
if (!databaseUrl) throw new Error("DATABASE_URL must name the box's identity database");

const users = await readBoxUsers(databaseUrl);
importUsers(environment, users);
const imported = targetUserCount(environment);
console.info(JSON.stringify({ environment, source: users.length, target: imported }));
if (imported !== users.length) {
  console.error(`user count mismatch: source ${users.length}, ${environment} ${imported}`);
  process.exit(1);
}
