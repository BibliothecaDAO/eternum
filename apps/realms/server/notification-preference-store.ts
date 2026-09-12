import { and, eq, lt, sql } from "drizzle-orm";
import { notificationPreferences } from "@realms-world/db";
import { db, type Database } from "@realms-world/db/client";
import { parseNotificationPreferences, type NotificationLevel } from "@bibliothecadao/notifications";

export function createNotificationPreferenceStore(database: Pick<Database, "select" | "insert" | "update"> = db) {
  const read = async (owner: string) => {
    const [row] = await database.select().from(notificationPreferences).where(eq(notificationPreferences.owner, owner));
    return parseNotificationPreferences(row ?? { owner, level: "off", revision: 0 });
  };

  const save = async (owner: string, level: NotificationLevel, revision: number) => {
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
  };
  return { read, save };
}
