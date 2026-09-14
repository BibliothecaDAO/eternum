import { Context, Data, Effect, Layer } from "effect";
import { and, eq, lt, sql } from "drizzle-orm";
import { notificationPreferences } from "@realms-world/db";
import { db, type Database } from "@realms-world/db/client";
import { parseNotificationPreferences, type NotificationLevel } from "@bibliothecadao/notifications";

export function createNotificationPreferenceStore(database: Pick<Database, "select" | "insert" | "update"> = db) {
  const read = (owner: string) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await database
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.owner, owner));
        return parseNotificationPreferences(row ?? { owner, level: "off", revision: 0 });
      },
      catch: (cause) => new NotificationPreferenceStorageError({ operation: "read", cause }),
    });

  const save = (owner: string, level: NotificationLevel, revision: number) =>
    Effect.tryPromise({
      try: async () => {
        // Revision zero also represents an account that has never saved preferences. Concurrent first saves race on the PK.
        if (revision === 0) {
          const [created] = await database
            .insert(notificationPreferences)
            .values({ owner, level, revision: 1 })
            .onConflictDoNothing()
            .returning();
          if (created) return parseNotificationPreferences(created);
        }
        const [updated] = await database
          .update(notificationPreferences)
          .set({ level, revision: sql`${notificationPreferences.revision} + 1` })
          .where(
            and(
              eq(notificationPreferences.owner, owner),
              eq(notificationPreferences.revision, revision),
              lt(notificationPreferences.revision, 2147483647),
            ),
          )
          .returning();
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

type NotificationPreferenceStoreShape = ReturnType<typeof createNotificationPreferenceStore>;
export class NotificationPreferenceStore extends Context.Service<
  NotificationPreferenceStore,
  NotificationPreferenceStoreShape
>()("NotificationPreferenceStore") {
  static readonly layer = Layer.sync(NotificationPreferenceStore, () => createNotificationPreferenceStore());
}
