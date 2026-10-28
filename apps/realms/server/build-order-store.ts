import { Context, Data, Effect, Layer } from "effect";

const MAX_REVISION = 2147483647;

/** A book as stored: its JSON text, read by the caller, and its revision. */
export interface StoredBuildOrderBook {
  owner: string;
  book: string;
  revision: number;
}

/** An account that never saved build orders holds none, at revision zero. */
const EMPTY_BOOK = JSON.stringify({ orders: [], active: null });

function createBuildOrderStore(db: D1Database) {
  const read = (owner: string) =>
    Effect.tryPromise({
      try: async (): Promise<StoredBuildOrderBook> => {
        const row = await db
          .prepare('SELECT "owner", "book", "revision" FROM "build_order_books" WHERE "owner" = ?')
          .bind(owner)
          .first<StoredBuildOrderBook>();
        return row ?? { owner, book: EMPTY_BOOK, revision: 0 };
      },
      catch: (cause) => new BuildOrderStorageError({ operation: "read", cause }),
    });

  /** Saves over `revision` only: null when another save came first. */
  const save = (owner: string, book: string, revision: number) =>
    Effect.tryPromise({
      try: async (): Promise<StoredBuildOrderBook | null> => {
        // Revision zero is also an account that never saved. Concurrent first saves race on the primary key.
        if (revision === 0) {
          const created = await db
            .prepare(
              'INSERT INTO "build_order_books" ("owner", "book", "revision") VALUES (?, ?, 1) ON CONFLICT DO NOTHING RETURNING *',
            )
            .bind(owner, book)
            .first<StoredBuildOrderBook>();
          if (created) return created;
        }
        return db
          .prepare(
            'UPDATE "build_order_books" SET "book" = ?, "revision" = "revision" + 1 WHERE "owner" = ? AND "revision" = ? AND "revision" < ? RETURNING *',
          )
          .bind(book, owner, revision, MAX_REVISION)
          .first<StoredBuildOrderBook>();
      },
      catch: (cause) => new BuildOrderStorageError({ operation: "save", cause }),
    });
  return { read, save };
}

class BuildOrderStorageError extends Data.TaggedError("BuildOrderStorageError")<{
  readonly operation: "read" | "save";
  readonly cause: unknown;
}> {}

export class BuildOrderStore extends Context.Service<BuildOrderStore, ReturnType<typeof createBuildOrderStore>>()(
  "BuildOrderStore",
) {
  static readonly layer = (db: D1Database) => Layer.sync(BuildOrderStore, () => createBuildOrderStore(db));
}
