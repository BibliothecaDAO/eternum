import { identityClient } from "@/hooks/context/identity-session";
import { isNotificationLevel, type NotificationLevel } from "@bibliothecadao/notifications";
import { useEffect } from "react";
import { create } from "zustand";

const ACCOUNT_CHANGE_KEY = "eternum:account-notification-change:v1";
const ANONYMOUS_KEY = "eternum:anonymous-notification-level:v1";
type SavedPreference = { level: NotificationLevel; revision: number; owner: string | null };
interface PreferenceState {
  owner: string | null | undefined;
  status: "loading" | "ready" | "saving" | "error";
  saved: SavedPreference | null;
  error: string | null;
}

// Settings and live dispatch share the same acknowledged account preference, including pending/error state.
export const useNotificationPreferenceStore = create<PreferenceState>(() => ({
  owner: undefined,
  status: "loading",
  saved: null,
  error: null,
}));
type PreferenceOperation = { owner: string | null; invalidated: boolean };
let activeOperation: PreferenceOperation | null = null;

async function reload(owner: string | null, invalidate = false): Promise<void> {
  if (activeOperation?.owner === owner) {
    // An invalidation during IO must trigger a fresh read after that IO settles.
    activeOperation.invalidated ||= invalidate;
    return;
  }
  await runPreferenceOperation(owner, "loading", () =>
    owner ? identityClient.getNotificationPreferences() : readAnonymousPreference(),
  );
}

async function save(owner: string | null, level: NotificationLevel): Promise<void> {
  const state = useNotificationPreferenceStore.getState();
  if (state.owner !== owner || state.status !== "ready" || !state.saved) return;
  const revision = state.saved.revision;
  await runPreferenceOperation(owner, "saving", async () => {
    if (!owner) return saveAnonymousPreference(level);
    const saved = await identityClient.saveNotificationPreferences({ owner, level, revision });
    if (saved.owner === owner) publishAccountPreferenceChange(saved);
    return saved;
  });
}

async function runPreferenceOperation(
  owner: string | null,
  status: "loading" | "saving",
  work: () => SavedPreference | Promise<SavedPreference>,
): Promise<void> {
  const operation = { owner, invalidated: false };
  activeOperation = operation;
  const store = useNotificationPreferenceStore;
  const previous = store.getState();
  store.setState({ owner, status, saved: previous.owner === owner ? previous.saved : null, error: null });
  try {
    const saved = await work();
    if (saved.owner !== owner) throw new Error("Your account changed. Reload your preferences.");
    if (activeOperation === operation && !operation.invalidated) store.setState({ status: "ready", saved });
  } catch (error) {
    if (activeOperation === operation && !operation.invalidated)
      store.setState({ status: "error", error: errorMessage(error) });
  } finally {
    if (activeOperation === operation) {
      activeOperation = null;
      if (operation.invalidated) await reload(owner);
    }
  }
}

// This is an invalidation signal, never a second copy of the server-owned preference.
function publishAccountPreferenceChange(saved: SavedPreference): void {
  try {
    localStorage.setItem(ACCOUNT_CHANGE_KEY, JSON.stringify({ owner: saved.owner, revision: saved.revision }));
  } catch {
    throw new Error(
      "Preference saved, but other tabs could not be updated. Allow site storage and reload preferences.",
    );
  }
}

function isPreferenceStorageChange(event: StorageEvent, owner: string | null): boolean {
  if (event.storageArea && event.storageArea !== localStorage) return false;
  if (event.key === null) return true;
  if (!owner) return event.key === ANONYMOUS_KEY;
  if (event.key !== ACCOUNT_CHANGE_KEY || !event.newValue) return false;
  try {
    return JSON.parse(event.newValue)?.owner === owner;
  } catch {
    return false;
  }
}

export function useNotificationPreferences(owner: string | null) {
  const state = useNotificationPreferenceStore();
  useEffect(() => {
    void reload(owner);
    const refresh = () => {
      void reload(owner, true);
    };
    const storage = (event: StorageEvent) => {
      if (isPreferenceStorageChange(event, owner)) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", storage);
    };
  }, [owner]);
  return {
    status: state.owner === owner ? state.status : ("loading" as const),
    saved: state.owner === owner ? state.saved : null,
    error: state.owner === owner ? state.error : null,
    reload: () => reload(owner),
    save: (level: NotificationLevel) => save(owner, level),
  };
}

function readAnonymousPreference(): SavedPreference {
  const level = localStorage.getItem(ANONYMOUS_KEY) ?? "off";
  if (!isNotificationLevel(level)) throw new Error("The saved notification level is invalid.");
  return { owner: null, level, revision: 0 };
}
function saveAnonymousPreference(level: NotificationLevel): SavedPreference {
  localStorage.setItem(ANONYMOUS_KEY, level);
  return { owner: null, level, revision: 0 };
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not save notification preferences.";
}
