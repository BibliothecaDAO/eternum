/**
 * The one-time move of Realms users from the box's Postgres into an identity D1 database: every user with their
 * linked wallet, name and portrait, each given the Realms id its user id derives. Sessions are not moved; players sign
 * in again. Prints SQL for `wrangler d1 execute DB --env <environment> --remote --file <file>` and reports the source
 * count on stderr, which the target's `SELECT count(*) FROM "user"` must match.
 *
 *   DATABASE_URL=postgres://… bun server/migrate-box-users.ts > /tmp/identity-users.sql
 */
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must name the box's identity database");
const users = await readBoxUsers(databaseUrl);
for (const user of users) console.log(insertUser(user));
console.error(`source users: ${users.length}`);
