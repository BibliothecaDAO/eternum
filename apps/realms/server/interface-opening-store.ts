import { parseOpeningRecord, type OpeningChange, type OpeningRecord } from "@realms-world/identity";
import { Context, Data, Effect, Layer } from "effect";

interface StoredOpening {
  owner: string;
  reached: string;
  showAll: number;
}

const recordOf = (row: StoredOpening): OpeningRecord =>
  parseOpeningRecord({ owner: row.owner, reached: JSON.parse(row.reached), showAll: row.showAll === 1 });

function createInterfaceOpeningStore(db: D1Database) {
  /** An account that never saved has reached nothing and shows the interface as it opens. */
  const read = (owner: string) =>
    Effect.tryPromise({
      try: async (): Promise<OpeningRecord> => {
        const row = await db
          .prepare('SELECT "owner", "reached", "showAll" FROM "interface_openings" WHERE "owner" = ?')
          .bind(owner)
          .first<StoredOpening>();
        return row ? recordOf(row) : { owner, reached: [], showAll: false };
      },
      catch: (cause) => new InterfaceOpeningStorageError({ operation: "read", cause }),
    });

  /**
   * Adds the moments to those kept, in one statement, so two devices saving at once both keep theirs; Show everything
   * changes only when the save names it.
   */
  const save = (change: OpeningChange) =>
    Effect.tryPromise({
      try: async (): Promise<OpeningRecord> => {
        const showAll = change.showAll === undefined ? null : change.showAll ? 1 : 0;
        const row = await db
          .prepare(
            `INSERT INTO "interface_openings" ("owner", "reached", "showAll") VALUES (?1, ?2, coalesce(?3, 0))
             ON CONFLICT ("owner") DO UPDATE SET
               "reached" = (SELECT json_group_array("value") FROM (
                 SELECT "value" FROM json_each("interface_openings"."reached")
                 UNION SELECT "value" FROM json_each(excluded."reached"))),
               "showAll" = coalesce(?3, "interface_openings"."showAll")
             RETURNING *`,
          )
          .bind(change.owner, JSON.stringify([...new Set(change.reach)]), showAll)
          .first<StoredOpening>();
        if (!row) throw new Error("interface_opening_not_written");
        return recordOf(row);
      },
      catch: (cause) => new InterfaceOpeningStorageError({ operation: "save", cause }),
    });
  return { read, save };
}

class InterfaceOpeningStorageError extends Data.TaggedError("InterfaceOpeningStorageError")<{
  readonly operation: "read" | "save";
  readonly cause: unknown;
}> {}

export class InterfaceOpeningStore extends Context.Service<
  InterfaceOpeningStore,
  ReturnType<typeof createInterfaceOpeningStore>
>()("InterfaceOpeningStore") {
  static readonly layer = (db: D1Database) => Layer.sync(InterfaceOpeningStore, () => createInterfaceOpeningStore(db));
}
