import { profileOfIdentityUser } from "@realms-world/identity";
import type { ShareKind, ShareChannel, ShareMoment, ShareTally } from "@realms-world/identity";

import { newPublicCode } from "./campaigns";

/** A shared link as a friend's landing reads it. */
export interface SharedLink {
  sharer: string;
  kind: ShareKind;
  moment: number;
  name: string | null;
}

/** A join not yet activated, with the season board that decides it. */
export interface PendingJoin {
  friend: string;
  chainId: string;
  gameId: number;
}

/** One moment's row of the operator's report: what its links did, from made to activated. */
export interface MomentReport extends ShareTally {
  kind: ShareKind;
  chainId: string;
  gameId: number;
  moment: number;
}

/** One sharer's row of the operator's report. */
export interface SharerReport extends ShareTally {
  realmsId: string;
  name: string | null;
}

/** A new code takes another try only when it collides with another link's; eight letters make that rare. */
const CODE_ATTEMPTS = 4;

/**
 * A visit counts for a link only from a browser its sharer was never signed in on: the sharer opening their own post
 * is no reach. `v` is the visit, `l` its link.
 */
const OTHERS_VISIT = `NOT EXISTS (SELECT 1 FROM "account_browsers" s WHERE s."realmsId" = l."sharer" AND s."browser" = v."browser")`;

/**
 * Each link's funnel as one row per group: links made, posted, visits from others' browsers, joins and activations.
 * Counted in subqueries per link so a link's visits and joins never multiply each other.
 */
const tallySelect = (groupColumns: string, where: string) => `
  SELECT ${groupColumns ? `${groupColumns},` : ""}
         COUNT(*) AS "links",
         COUNT(l."posted_at") AS "posted",
         COALESCE(SUM((SELECT COUNT(*) FROM "share_visits" v WHERE v."code" = l."code" AND ${OTHERS_VISIT})), 0) AS "visits",
         COALESCE(SUM((SELECT COUNT(*) FROM "share_joins" j WHERE j."code" = l."code")), 0) AS "joined",
         COALESCE(SUM((SELECT COUNT(*) FROM "share_joins" j WHERE j."code" = l."code" AND j."activated_at" IS NOT NULL)), 0)
           AS "activated"
  FROM "share_links" l
  ${where}`;

/**
 * Shared links, their visits and the accounts they brought, in D1 (migrations/0032_shares.sql). Joins are written
 * from what D1 already holds (a visit's browser, the accounts signed in on it, when each was made), so a sign-up
 * reports nothing of its own and any read may settle them.
 */
export function createShareStore(db: D1Database) {
  const linkOf = (sharer: string, { kind, chainId, gameId, moment }: ShareMoment) =>
    db
      .prepare(
        `SELECT "code" FROM "share_links"
         WHERE "sharer" = ? AND "kind" = ? AND "chain_id" = ? AND "game_id" = ? AND "moment" = ?`,
      )
      .bind(sharer, kind, chainId, gameId, moment)
      .first<{ code: string }>();

  /** The sharer's link for one moment, made on first ask and the same ever after. Safe to repeat, and to race. */
  const linkFor = async (sharer: string, moment: ShareMoment, now: number): Promise<string> => {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const held = await linkOf(sharer, moment);
      if (held) return held.code;
      await db
        .prepare(
          `INSERT INTO "share_links" ("code", "sharer", "kind", "chain_id", "game_id", "moment", "created_at")
           VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        )
        .bind(newPublicCode(), sharer, moment.kind, moment.chainId, moment.gameId, moment.moment, now)
        .run();
    }
    throw new Error("share_code_unavailable");
  };

  /** Marks the sharer's own link posted, once; false when the link is not theirs. */
  const markPosted = async (sharer: string, code: string, now: number): Promise<boolean> => {
    const owned = await db
      .prepare(`SELECT 1 AS "owned" FROM "share_links" WHERE "code" = ? AND "sharer" = ?`)
      .bind(code, sharer)
      .first();
    if (!owned) return false;
    await db
      .prepare(`UPDATE "share_links" SET "posted_at" = ? WHERE "code" = ? AND "posted_at" IS NULL`)
      .bind(now, code)
      .run();
    return true;
  };

  /** The link with its sharer's public name; null for a code no link has. */
  const sharedLink = (code: string) =>
    db
      .prepare(
        `SELECT l."sharer", l."kind", l."moment", u."id", u."name", u."image" FROM "share_links" l
         JOIN "user" u ON u."realmsId" = l."sharer" WHERE l."code" = ?`,
      )
      .bind(code)
      .first<{ sharer: string; kind: ShareKind; moment: number; id: string; name: string; image: string | null }>()
      .then((row): SharedLink | null =>
        row ? { sharer: row.sharer, kind: row.kind, moment: row.moment, name: profileOfIdentityUser(row).name } : null,
      );

  /** The browser's first visit to the link, with the channel it came through; a later one keeps the first. */
  const recordVisit = (code: string, browser: string, via: ShareChannel | null) =>
    db
      .prepare(
        `INSERT INTO "share_visits" ("code", "browser", "at", "via")
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?) ON CONFLICT DO NOTHING`,
      )
      .bind(code, browser, via)
      .run();

  /**
   * Gives each account made after one of its browsers opened another player's link to that link: the first such visit
   * (first touch) and only once, joined when the account was made, however late a read settles it. The sharer's own
   * accounts, and any account on a browser the sharer was signed in on, join no one's link.
   */
  const settleJoins = () =>
    db
      .prepare(
        `INSERT OR IGNORE INTO "share_joins" ("friend", "code", "joined_at")
         SELECT b."realmsId", v."code", CAST(strftime('%s', u."createdAt") AS INTEGER)
         FROM "share_visits" v
         JOIN "share_links" l ON l."code" = v."code"
         JOIN "account_browsers" b ON b."browser" = v."browser"
         JOIN "user" u ON u."realmsId" = b."realmsId"
         WHERE julianday(v."at") < julianday(u."createdAt") AND b."realmsId" <> l."sharer" AND ${OTHERS_VISIT}
           AND NOT EXISTS (SELECT 1 FROM "share_joins" j WHERE j."friend" = b."realmsId")
         ORDER BY julianday(v."at")`,
      )
      .run();

  /** Joins not yet activated, every sharer's or one sharer's, with the season board of the link that brought each. */
  const pendingJoins = async (sharer?: string): Promise<PendingJoin[]> =>
    (
      await db
        .prepare(
          `SELECT j."friend", l."chain_id" AS "chainId", l."game_id" AS "gameId"
           FROM "share_joins" j JOIN "share_links" l ON l."code" = j."code"
           WHERE j."activated_at" IS NULL AND (?1 IS NULL OR l."sharer" = ?1)`,
        )
        .bind(sharer ?? null)
        .all<PendingJoin>()
    ).results;

  const markActivated = (friends: readonly string[], now: number) =>
    friends.length === 0
      ? Promise.resolve()
      : db.batch(
          friends.map((friend) =>
            db
              .prepare(`UPDATE "share_joins" SET "activated_at" = ? WHERE "friend" = ? AND "activated_at" IS NULL`)
              .bind(now, friend),
          ),
        );

  /** What one account's links brought, every kind and moment together: one row, all zeros before its first link. */
  const tallyOf = async (sharer: string): Promise<ShareTally> => {
    const tally = await db.prepare(tallySelect("", `WHERE l."sharer" = ?`)).bind(sharer).first<ShareTally>();
    // An aggregate without GROUP BY always answers one row.
    if (!tally) throw new Error("share_tally_unanswered");
    return tally;
  };

  /** Every moment's funnel, newest moment first. */
  const momentReport = async (): Promise<MomentReport[]> =>
    (
      await db
        .prepare(
          tallySelect(
            `l."kind", l."chain_id" AS "chainId", l."game_id" AS "gameId", l."moment"`,
            `GROUP BY l."kind", l."chain_id", l."game_id", l."moment"
             ORDER BY l."game_id" DESC, l."moment" DESC`,
          ),
        )
        .all<MomentReport>()
    ).results;

  /**
   * First visits from others' browsers by the tag their link carried (`?via=`, null for none). A tag says which button
   * made the link, not which app carried it, and a link posted both ways has no count of posts per tag: these are
   * visits, never a rate per post.
   */
  const firstVisitsByTag = async (): Promise<{ tag: ShareChannel | null; visits: number }[]> =>
    (
      await db
        .prepare(
          `SELECT v."via" AS "tag", COUNT(*) AS "visits"
           FROM "share_visits" v JOIN "share_links" l ON l."code" = v."code"
           WHERE ${OTHERS_VISIT} GROUP BY v."via" ORDER BY "visits" DESC`,
        )
        .all<{ tag: ShareChannel | null; visits: number }>()
    ).results;

  /** The sharers who brought the most, by activations, then joins, then visits. */
  const topSharers = async (limit: number): Promise<SharerReport[]> =>
    (
      await db
        .prepare(
          `SELECT t.*, u."id", u."name", u."image" FROM (
             ${tallySelect(`l."sharer" AS "realmsId"`, `GROUP BY l."sharer"`)}
           ) t JOIN "user" u ON u."realmsId" = t."realmsId"
           ORDER BY t."activated" DESC, t."joined" DESC, t."visits" DESC LIMIT ?`,
        )
        .bind(limit)
        .all<SharerReport & { id: string; name: string; image: string | null }>()
    ).results.map(({ id, image, name, ...row }) => ({ ...row, name: profileOfIdentityUser({ id, name, image }).name }));

  return {
    linkFor,
    markPosted,
    sharedLink,
    recordVisit,
    settleJoins,
    pendingJoins,
    markActivated,
    tallyOf,
    momentReport,
    firstVisitsByTag,
    topSharers,
  };
}
