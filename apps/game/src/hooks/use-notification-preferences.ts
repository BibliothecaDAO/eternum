import { identityClient } from "@/hooks/context/identity-session";
import { isNotificationLevel, type NotificationLevel } from "@bibliothecadao/notifications";
import { useEffect } from "react";
import { create } from "zustand";

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
let operation = 0;
let loading = false;

async function reload(owner: string | null): Promise<void> {
  const store = useNotificationPreferenceStore;
  const previous = store.getState();
  if (previous.owner === owner && (loading || previous.status === "saving")) return;
  const current = ++operation;
  loading = true;
  store.setState({ owner, status: "loading", saved: previous.owner === owner ? previous.saved : null, error: null });
  try {
    const saved = owner ? await identityClient.getNotificationPreferences() : readAnonymousPreference();
    if (saved.owner !== owner) throw new Error("Your account changed. Reopen Settings to load its preferences.");
    if (current === operation) store.setState({ status: "ready", saved, error: null });
  } catch (error) {
    if (current === operation) store.setState({ status: "error", error: errorMessage(error) });
  } finally {
    if (current === operation) loading = false;
  }
}

async function save(owner: string | null, level: NotificationLevel): Promise<void> {
  const store = useNotificationPreferenceStore;
  const state = store.getState();
  if (state.owner !== owner || state.status !== "ready" || !state.saved) return;
  const current = ++operation;
  store.setState({ status: "saving", error: null });
  try {
    const saved = owner
      ? await identityClient.saveNotificationPreferences({ owner, level, revision: state.saved.revision })
      : saveAnonymousPreference(level);
    if (saved.owner !== owner) throw new Error("Your account changed. Reload your preferences.");
    if (current === operation) store.setState({ status: "ready", saved, error: null });
  } catch (error) {
    if (current === operation) store.setState({ status: "error", error: errorMessage(error) });
  }
}

export function useNotificationPreferences(owner: string | null) {
  const state = useNotificationPreferenceStore();
  useEffect(() => {
    void reload(owner);
    const refresh = () => {
      void reload(owner);
    };
    const storage = (event: StorageEvent) => {
      if (!owner && (event.key === null || event.key === ANONYMOUS_KEY)) refresh();
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
