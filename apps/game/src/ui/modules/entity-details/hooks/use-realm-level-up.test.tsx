import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REALM = 7;
const facts = vi.hoisted(() => ({
  upgrade: {} as Record<string, unknown>,
  provision: null as unknown,
  closed: null as string | null,
}));
const calls = vi.hoisted(() => ({
  upgrade_realm: vi.fn(),
  provision_realm: vi.fn(),
  waitForAction: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ waitForAction: calls.waitForAction }),
}));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    account: { account: { address: "0x1" } },
    setup: { systemCalls: { upgrade_realm: calls.upgrade_realm, provision_realm: calls.provision_realm } },
  }),
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { error: calls.toastError } }));
vi.mock("./use-blitz-realm-provision", () => ({ useBlitzRealmProvision: () => facts.provision }));
vi.mock("@/utils/can-issue-orders", () => ({ useActNowRefusal: () => facts.closed }));
// The real hook's readiness, as the game's facts give it, and its lock, read from the shared in-flight store.
vi.mock("./use-structure-upgrade", async () => {
  const { useInFlight } = await import("@/hooks/store/use-actions-in-flight");
  return {
    useStructureUpgrade: (id: number) => ({
      ...facts.upgrade,
      isUpgradeLocked: useInFlight("castle", id) !== undefined,
    }),
  };
});

import { type RealmLevelUp, useRealmLevelUp } from "./use-realm-level-up";

const LABOR = 23;
const realm = (overrides: Record<string, unknown>) => ({
  currentLevel: 0,
  nextLevel: 1,
  nextLevelName: "City",
  hasRecipe: true,
  canUpgrade: true,
  requirements: [],
  isOwner: true,
  isMaxLevel: false,
  ...overrides,
});

/** Two surfaces offering the same realm's step, as the card and Next up do. */
const renderSurfaces = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const seen: { card: RealmLevelUp | null; nextUp: RealmLevelUp | null } = { card: null, nextUp: null };
  const Surface = ({ read }: { read: (levelUp: RealmLevelUp | null) => void }) => {
    read(useRealmLevelUp(REALM));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <>
        <Surface read={(levelUp) => (seen.card = levelUp)} />
        <Surface read={(levelUp) => (seen.nextUp = levelUp)} />
      </>,
    ),
  );
  return { seen, unmount: () => act(async () => root.unmount()) };
};

beforeEach(() => {
  facts.provision = null;
  facts.closed = null;
  calls.upgrade_realm.mockResolvedValue({ transaction_hash: "0xabc" });
  calls.provision_realm.mockResolvedValue({ transaction_hash: "0xdef" });
});
afterEach(() => vi.clearAllMocks());

describe("a realm's level-up step", () => {
  it("is neither offered nor sent when the game has no recipe for the next level", async () => {
    facts.upgrade = realm({ hasRecipe: false, canUpgrade: false, requirements: [] });
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ mode: "level-up", ready: false, loading: false });
    expect(seen.card?.refusal).toBe("No recipe for the next level");
    await act(async () => seen.card?.run());
    expect(calls.upgrade_realm).not.toHaveBeenCalled();
    await unmount();
  });

  it("is offered and sent once when the next level's recipe is free", async () => {
    facts.upgrade = realm({ requirements: [] });
    calls.waitForAction.mockResolvedValue({ status: "SUCCEEDED" });
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ word: "Level up to City", ready: true, refusal: null });
    await act(async () => seen.card?.run());
    expect(calls.upgrade_realm).toHaveBeenCalledTimes(1);
    expect(calls.upgrade_realm).toHaveBeenCalledWith({ signer: { address: "0x1" }, realm_entity_id: REALM });
    await unmount();
  });

  it("waits for resources the realm does not hold", async () => {
    const short = { resource: LABOR, amount: 180, current: 40, progress: 22, incoming: null };
    facts.upgrade = realm({ canUpgrade: false, requirements: [short] });
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ ready: false, refusal: "Need resources", requirements: [short] });
    await act(async () => seen.card?.run());
    expect(calls.upgrade_realm).not.toHaveBeenCalled();
    await unmount();
  });

  it("holds every surface while one surface's step is in flight, until the game applies it", async () => {
    facts.upgrade = realm({});
    let apply: (outcome: unknown) => void = () => {};
    calls.waitForAction.mockReturnValueOnce(new Promise((resolve) => (apply = resolve)));
    const { seen, unmount } = await renderSurfaces();

    await act(async () => seen.card?.run());
    expect(seen.nextUp).toMatchObject({ ready: false, loading: true, refusal: null });
    await act(async () => seen.nextUp?.run());
    expect(calls.upgrade_realm).toHaveBeenCalledTimes(1);

    await act(async () => apply({ status: "SUCCEEDED" }));
    expect(seen.nextUp).toMatchObject({ ready: true, loading: false });
    await unmount();
  });

  it("provisions a fresh Blitz realm first, with its first level in the same send when affordable", async () => {
    facts.upgrade = realm({});
    facts.provision = { needsBootstrap: true };
    calls.waitForAction.mockResolvedValue({ status: "SUCCEEDED" });
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ mode: "provision", word: "Provision", ready: true });
    await act(async () => seen.card?.run());
    expect(calls.provision_realm).toHaveBeenCalledWith({
      signer: { address: "0x1" },
      realm_entity_id: REALM,
      upgrade: true,
    });
    expect(calls.upgrade_realm).not.toHaveBeenCalled();
    await unmount();
  });

  it("keeps Provision shut before play opens, saying when it does", async () => {
    facts.upgrade = realm({});
    facts.provision = { needsBootstrap: true };
    facts.closed = "Starts in 4m 00s";
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ mode: "provision", ready: false, refusal: "Starts in 4m 00s" });
    await act(async () => seen.card?.run());
    expect(calls.provision_realm).not.toHaveBeenCalled();
    await unmount();
  });

  it("keeps a level-up the realm can afford shut before play opens", async () => {
    facts.upgrade = realm({});
    facts.closed = "Starts in 4m 00s";
    const { seen, unmount } = await renderSurfaces();
    expect(seen.card).toMatchObject({ mode: "level-up", ready: false, refusal: "Starts in 4m 00s" });
    await act(async () => seen.card?.run());
    expect(calls.upgrade_realm).not.toHaveBeenCalled();
    await unmount();
  });
});
