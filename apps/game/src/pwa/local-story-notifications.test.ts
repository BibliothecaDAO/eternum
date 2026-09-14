import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "0x1" as string | null,
  account: "0xa",
  spectator: false,
  preferences: { status: "ready", saved: { owner: "0x1", level: "important" } },
  world: { gameId: 7, chain: "madara", worldAddress: "0x123", name: "game-1" },
  device: vi.fn(),
  send: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySessionStore: { getState: () => ({ session: mocks.owner ? { user: { id: mocks.owner } } : null }) },
}));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: { getState: () => ({ account: { address: mocks.account } }) },
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferenceStore: { getState: () => mocks.preferences },
}));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => mocks.world }));
vi.mock("@/play/navigation/play-route", () => ({
  parsePlayRoute: () => ({ worldName: "game-1" }),
  buildEntryHref: () => "/enter/madara/game-1",
}));
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => mocks.spectator }));
vi.mock("./local-notification-client", () => ({
  localNotificationCapability: () => null,
  readLocalNotificationDevice: mocks.device,
  notificationWorkerRequest: mocks.send,
  reportNotificationDeliveryError: mocks.error,
}));
import { dispatchLocalStoryNotification } from "./local-story-notifications";
const scope = { chain: "madara", worldAddress: "0x123", gameId: 7 };
const live = { block: 20, preconfirmed: false, confirmedAfterAttach: true };
function event() {
  return {
    hashed_keys: "0xabc",
    models: {
      StoryEvent: {
        game_id: 7,
        id: 100,
        owner: "0xa",
        entity_id: 11,
        tx_hash: "0xabc",
        timestamp: Math.floor(Date.now() / 1000),
        story: {
          BattleStory: {
            attacker_id: 11,
            defender_id: 22,
            attacker_owner_address: "0xa",
            defender_owner_address: "0xb",
          },
        },
      },
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = "0x1";
  mocks.account = "0xa";
  mocks.spectator = false;
  mocks.world = { gameId: 7, chain: "madara", worldAddress: "0x123", name: "game-1" };
  mocks.preferences = { status: "ready", saved: { owner: "0x1", level: "important" } };
  mocks.device.mockResolvedValue({ owner: "0x1", token: "token", enabledAt: Date.now() - 10_000 });
  vi.stubGlobal("Notification", { permission: "granted" });
});
afterEach(() => vi.unstubAllGlobals());
it("dispatches an eligible new confirmed event and groups mirrored copies", async () => {
  const first = event();
  dispatchLocalStoryNotification(first, scope, live);
  await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  const firstPayload = mocks.send.mock.calls[0][2].payload;
  const second = event();
  Object.assign(second.models.StoryEvent, { id: 101, owner: "0xb", entity_id: 22 });
  dispatchLocalStoryNotification(second, scope, live);
  await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][2].payload.id).toBe(firstPayload.id);
  expect(firstPayload.target).toBe("/enter/madara/game-1");
  expect(firstPayload.owner).toBe("0x1");
});
it("never dispatches history, unknown confirmation, provisional events, spectators, off or unrelated activity", async () => {
  dispatchLocalStoryNotification(event(), scope, { ...live, confirmedAfterAttach: false });
  dispatchLocalStoryNotification(event(), scope, { block: 20, preconfirmed: false });
  dispatchLocalStoryNotification(event(), scope, { ...live, preconfirmed: true });
  mocks.spectator = true;
  dispatchLocalStoryNotification(event(), scope, live);
  mocks.spectator = false;
  mocks.preferences.saved.level = "off";
  dispatchLocalStoryNotification(event(), scope, live);
  mocks.preferences.saved.level = "important";
  mocks.account = "0xc";
  dispatchLocalStoryNotification(event(), scope, live);
  await Promise.resolve();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.device).not.toHaveBeenCalled();
});
it.each(["owner", "world", "saving", "loading", "error"])(
  "drops pending work when %s changes before delivery",
  async (change) => {
    let finish!: (value: unknown) => void;
    mocks.device.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    dispatchLocalStoryNotification(event(), scope, live);
    if (change === "owner") mocks.owner = "0x2";
    else if (change === "world") mocks.world = { ...mocks.world, worldAddress: "0x999" };
    else mocks.preferences.status = change;
    finish({ owner: "0x1", token: "token", enabledAt: Date.now() - 10_000 });
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.send).not.toHaveBeenCalled();
  },
);
