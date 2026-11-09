/**
 * Chat keeps a message thirty days, in a room and in each inbox, and then deletes it. An object deletes what is past
 * that before it answers a read and after each new message, and its alarm wakes it when its oldest message turns thirty
 * days, so a room or an inbox nobody opens again empties too. The alarm is one wake per expiry; nothing else runs while
 * the object is quiet.
 */
export const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The time at or before which a message is past retention: one written thirty days ago is gone at its alarm. */
export const retentionCutoff = (now = Date.now()) => now - CHAT_RETENTION_MS;

/** Sets the object's alarm to when its oldest message (null: none left) turns thirty days, or clears it. */
export const wakeAtNextExpiry = async (storage: DurableObjectStorage, oldest: number | null): Promise<void> => {
  if (oldest === null) return storage.deleteAlarm();
  const expiry = oldest + CHAT_RETENTION_MS;
  if ((await storage.getAlarm()) !== expiry) await storage.setAlarm(expiry);
};
