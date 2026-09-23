/**
 * The one-time move of Realms users from the box's Postgres into an identity D1 database: every user with their
 * linked wallet, name and portrait, each given the Realms id its user id derives. Sessions are not moved; players sign
 * in again. The source is read in a read-only transaction. A user already in the target is left as it is, so a second
 * run writes nothing. The move fails unless every source user is then in the target, and names each one that is not
 * by the unique field another target user already holds.
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

interface TargetUser {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

const sqlText = (value: string | null) => (value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`);

/** Any unique field already taken (the id on a rerun, or a name, email or wallet another user holds) skips the row. */
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
  ].join(", ")}) ON CONFLICT DO NOTHING;`;

const readBoxUsers = async (databaseUrl: string): Promise<BoxUser[]> => {
  const client = new pg.Client({ connectionString: databaseUrl, options: "-c default_transaction_read_only=on" });
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

const readTargetUsers = (environment: string) =>
  d1(environment, "--command", 'SELECT "id", "name", "email", "address" FROM "user"')[0]!
    .results as unknown as TargetUser[];

/** The unique fields a source user could not take because another target user holds them. */
const conflictsOf = (user: BoxUser, target: readonly TargetUser[]): string[] => {
  const others = target.filter(({ id }) => id !== user.id);
  return [
    others.some(({ name }) => name.toLowerCase() === user.name.toLowerCase()) ? "name" : null,
    others.some(({ email }) => email === user.email) ? "email" : null,
    user.address !== null && others.some(({ address }) => address === user.address) ? "wallet" : null,
  ].filter((field): field is string => field !== null);
};

const countsOf = (users: readonly { name: string; address: string | null }[]) => ({
  users: users.length,
  wallets: users.filter(({ address }) => address !== null).length,
  names: users.filter(({ name }) => name.length > 0).length,
});

const environment = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
if (environment !== "staging" && environment !== "production")
  throw new Error("name the environment: staging or production");
if (!databaseUrl) throw new Error("DATABASE_URL must name the box's identity database");

const source = await readBoxUsers(databaseUrl);
const sourceIds = new Set(source.map(({ id }) => id));
const presentBefore = readTargetUsers(environment).filter(({ id }) => sourceIds.has(id)).length;
importUsers(environment, source);
const target = readTargetUsers(environment);
const moved = target.filter(({ id }) => sourceIds.has(id));
const movedIds = new Set(moved.map(({ id }) => id));
const skipped = source
  .filter(({ id }) => !movedIds.has(id))
  .map((user) => ({ id: user.id, heldByAnotherUser: conflictsOf(user, target) }));

console.info(
  JSON.stringify({
    environment,
    source: countsOf(source),
    target: countsOf(moved),
    insertedThisRun: moved.length - presentBefore,
    skipped,
  }),
);
if (skipped.length > 0) {
  console.error(`${skipped.length} of ${source.length} users are not in ${environment}`);
  process.exit(1);
}
