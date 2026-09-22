import { Context, Data, Effect, Layer } from "effect";
import { parseNotificationPreferences, type NotificationLevel } from "@bibliothecadao/notifications";

const MAX_REVISION = 2147483647;

function createNotificationPreferenceStore(db: D1Database) {
  const read = (owner: string) =>
    Effect.tryPromise({
      try: async () => {
        const row = await db
          .prepare('SELECT "owner", "level", "revision" FROM "notification_preferences" WHERE "owner" = ?')
          .bind(owner)
          .first();
        return parseNotificationPreferences(row ?? { owner, level: "off", revision: 0 });
      },
      catch: (cause) => new NotificationPreferenceStorageError({ operation: "read", cause }),
    });

  const save = (owner: string, level: NotificationLevel, revision: number) =>
    Effect.tryPromise({
      try: async () => {
        // Revision zero also represents an account that has never saved preferences. Concurrent first saves race on the PK.
        if (revision === 0) {
          const created = await db
            .prepare(
              'INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, ?, 1) ON CONFLICT DO NOTHING RETURNING *',
            )
            .bind(owner, level)
            .first();
          if (created) return parseNotificationPreferences(created);
        }
        const updated = await db
          .prepare(
            'UPDATE "notification_preferences" SET "level" = ?, "revision" = "revision" + 1 WHERE "owner" = ? AND "revision" = ? AND "revision" < ? RETURNING *',
          )
          .bind(level, owner, revision, MAX_REVISION)
          .first();
        return updated ? parseNotificationPreferences(updated) : null;
      },
      catch: (cause) => new NotificationPreferenceStorageError({ operation: "save", cause }),
    });
  return { read, save };
}

class NotificationPreferenceStorageError extends Data.TaggedError("NotificationPreferenceStorageError")<{
  readonly operation: "read" | "save";
  readonly cause: unknown;
}> {}

export class NotificationPreferenceStore extends Context.Service<
  NotificationPreferenceStore,
  ReturnType<typeof createNotificationPreferenceStore>
>()("NotificationPreferenceStore") {
  static readonly layer = (db: D1Database) =>
    Layer.sync(NotificationPreferenceStore, () => createNotificationPreferenceStore(db));
}
