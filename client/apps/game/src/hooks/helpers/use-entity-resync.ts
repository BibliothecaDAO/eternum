import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export const ENTITY_RESYNC_COOLDOWN_MS = 10_000;
export const ENTITY_RESYNC_TIMEOUT_MS = 20_000;

type UseEntityResyncOptions = {
  cooldownMs?: number;
  timeoutMs?: number;
};

type SyncEntityParams = {
  syncKey: string;
  entityLabel: string;
  successMessage: string;
  errorMessage?: string;
  runSync: () => Promise<void>;
};

const toLowerEntityLabel = (entityLabel: string) => entityLabel.trim().toLowerCase();

export const useEntityResync = ({
  cooldownMs = ENTITY_RESYNC_COOLDOWN_MS,
  timeoutMs = ENTITY_RESYNC_TIMEOUT_MS,
}: UseEntityResyncOptions = {}) => {
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const lastSyncedAtRef = useRef<Map<string, number>>(new Map());

  const isSyncing = useCallback(
    (syncKey: string | null | undefined) => Boolean(syncKey) && syncingKey === syncKey,
    [syncingKey],
  );

  const syncEntity = useCallback(
    async ({ syncKey, entityLabel, successMessage, errorMessage, runSync }: SyncEntityParams) => {
      const now = Date.now();
      const normalizedEntityLabel = toLowerEntityLabel(entityLabel);
      const lastSyncedAt = lastSyncedAtRef.current.get(syncKey) ?? 0;
      const elapsedMs = now - lastSyncedAt;

      if (elapsedMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        toast.info(`Please wait ${remainingSeconds}s before re-syncing this ${normalizedEntityLabel}.`);
        return false;
      }

      lastSyncedAtRef.current.set(syncKey, now);
      setSyncingKey(syncKey);

      let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
      try {
        await new Promise<void>((resolve, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error("Resync timed out"));
          }, timeoutMs);

          void runSync().then(resolve).catch(reject);
        });
        toast.success(successMessage);
        return true;
      } catch (error) {
        console.error(`[resync] Failed to sync ${normalizedEntityLabel}`, error);
        toast.error(errorMessage ?? `Could not sync ${normalizedEntityLabel}. Please try again.`);
        return false;
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        setSyncingKey((currentSyncingKey) => (currentSyncingKey === syncKey ? null : currentSyncingKey));
      }
    },
    [cooldownMs, timeoutMs],
  );

  return {
    syncEntity,
    isSyncing,
    syncingKey,
  };
};
