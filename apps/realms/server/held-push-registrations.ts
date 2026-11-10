import { Effect } from "effect";

import { PushSubscriptionStore } from "./push-subscription-store";

// The push store as a test reaches it, with a registration's insert held where a request still running would be:
// authorized, and not yet written.

/** The store over `db`, as one Worker request reaches it. */
export const storeOver = (db: D1Database) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* PushSubscriptionStore;
    }).pipe(Effect.provide(PushSubscriptionStore.layer(db))),
  );

/** `db`, with each registration's insert held just before it runs until `release` is called. */
export const holdingInserts = (db: D1Database) => {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let reached = () => undefined as void;
  const atInsert = new Promise<void>((resolve) => (reached = resolve));
  const held = {
    ...db,
    prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (!sql.includes('INSERT INTO "notification_push_subscriptions"')) return statement;
      return {
        ...statement,
        bind: (...args: unknown[]) => {
          const bound = statement.bind(...args);
          return {
            ...bound,
            first: async () => {
              reached();
              await gate;
              return bound.first();
            },
          };
        },
      };
    },
  } as D1Database;
  return { held, atInsert, release };
};
