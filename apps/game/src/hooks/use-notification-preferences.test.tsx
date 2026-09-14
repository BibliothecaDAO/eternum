import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { getNotificationPreferences: api.get, saveNotificationPreferences: api.save },
}));
import { useNotificationPreferences, useNotificationPreferenceStore } from "./use-notification-preferences";

const changeKey = "eternum:account-notification-change:v1";
const important = { owner: "0x1", level: "important" as const, revision: 1 };
const off = { ...important, level: "off" as const, revision: 2 };
type Preference = typeof important | typeof off;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.clearAllMocks();
  api.get.mockReset().mockResolvedValue(important);
  api.save.mockReset().mockResolvedValue(off);
  useNotificationPreferenceStore.setState({ owner: undefined, status: "loading", saved: null, error: null });
});
afterEach(() => vi.restoreAllMocks());

async function mount() {
  let preferences!: ReturnType<typeof useNotificationPreferences>;
  const root = createRoot(document.createElement("div"));
  function Probe({ owner }: { owner: string }) {
    preferences = useNotificationPreferences(owner);
    return null;
  }
  const render = (owner = "0x1") => act(async () => root.render(<Probe owner={owner} />));
  await render();
  return {
    render,
    save: () => preferences.save("off"),
    close: () => act(async () => root.unmount()),
  };
}

async function invalidate(value = JSON.stringify({ owner: "0x1", revision: 2 })) {
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key: changeKey, newValue: value, storageArea: localStorage }));
  });
}

it("publishes only an owner/revision invalidation after the server acknowledges a save", async () => {
  const pending = deferred<Preference>();
  api.save.mockReturnValue(pending.promise);
  const ui = await mount();
  try {
    let saving!: Promise<void>;
    await act(async () => {
      saving = ui.save();
    });
    expect(localStorage.getItem(changeKey)).toBeNull();
    await act(async () => {
      pending.resolve(off);
      await saving;
    });
    expect(JSON.parse(localStorage.getItem(changeKey)!)).toEqual({ owner: "0x1", revision: 2 });
    expect(useNotificationPreferenceStore.getState().saved).toEqual(off);
  } finally {
    await ui.close();
  }
});

it("pauses a hidden tab immediately and fetches Off after another tab saves", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const ui = await mount();
  const pending = deferred<Preference>();
  api.get.mockReturnValueOnce(pending.promise);
  try {
    await invalidate();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(useNotificationPreferenceStore.getState()).toMatchObject({ status: "loading", saved: important });
    await act(async () => {
      pending.resolve(off);
    });
    expect(useNotificationPreferenceStore.getState()).toMatchObject({ status: "ready", saved: off });
  } finally {
    await ui.close();
  }
});

it.each(["read", "save"])("does not accept a stale %s response after invalidation", async (kind) => {
  const pending = deferred<Preference>();
  if (kind === "read") api.get.mockReturnValueOnce(pending.promise);
  const ui = await mount();
  if (kind === "save") {
    api.save.mockReturnValueOnce(pending.promise);
    await act(async () => {
      void ui.save();
    });
  }
  const refreshed = deferred<Preference>();
  api.get.mockReturnValueOnce(refreshed.promise);
  const accepted: string[] = [];
  const unsubscribe = useNotificationPreferenceStore.subscribe((state) => {
    if (state.status === "ready") accepted.push(state.saved!.level);
  });
  try {
    await invalidate();
    await act(async () => {
      pending.resolve(important);
    });
    expect(useNotificationPreferenceStore.getState().status).toBe("loading");
    expect(accepted).toEqual([]);
    await act(async () => {
      refreshed.resolve(off);
    });
    expect(accepted).toEqual(["off"]);
  } finally {
    unsubscribe();
    await ui.close();
  }
});

it("keeps delivery paused when the invalidated preference cannot be refreshed", async () => {
  const ui = await mount();
  api.get.mockRejectedValueOnce(new Error("Offline"));
  try {
    await invalidate();
    expect(useNotificationPreferenceStore.getState()).toMatchObject({ status: "error", error: "Offline" });
  } finally {
    await ui.close();
  }
});

it("ignores other owners and malformed signals, and removes the listener on unmount", async () => {
  const ui = await mount();
  await invalidate(JSON.stringify({ owner: "0x2", revision: 2 }));
  await invalidate("not-json");
  expect(api.get).toHaveBeenCalledTimes(1);
  await ui.close();
  await invalidate();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it("does not let an invalidated old account read replace the new account", async () => {
  const pending = deferred<Preference>();
  api.get.mockReturnValueOnce(pending.promise);
  const ui = await mount();
  try {
    await invalidate();
    api.get.mockResolvedValueOnce({ ...off, owner: "0x2" });
    await ui.render("0x2");
    await act(async () => {
      pending.resolve(important);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(useNotificationPreferenceStore.getState()).toMatchObject({
      owner: "0x2",
      status: "ready",
      saved: { owner: "0x2", level: "off" },
    });
  } finally {
    await ui.close();
  }
});

it("does not publish failed saves and reports failed cross-tab publication honestly", async () => {
  const ui = await mount();
  try {
    api.save.mockRejectedValueOnce(new Error("Revision conflict"));
    await act(async () => {
      await ui.save();
    });
    expect(localStorage.getItem(changeKey)).toBeNull();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    await act(async () => {
      await ui.save();
    });
    expect(useNotificationPreferenceStore.getState()).toMatchObject({
      status: "error",
      error: expect.stringContaining("Preference saved, but other tabs could not be updated"),
    });
  } finally {
    await ui.close();
  }
});
