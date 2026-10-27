import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const game = vi.hoisted(() => ({
  mode: "blitz",
  ordersAllowed: true,
  steps: [] as unknown[],
  build: vi.fn(async () => undefined),
  levelUp: vi.fn(),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useResolvedWorldGameMode: () => game.mode }));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => game.ordersAllowed,
  useActNowRefusal: () => null,
}));
// The steps as the game reads them: the account's orders loaded by the same read, the steps the case gives.
vi.mock("@/ui/features/world/containers/left-facets/use-empire-suggestions", async () => {
  const { useBuildOrderAccount } = await import("@/hooks/use-build-orders");
  return {
    useEmpireSuggestions: () => {
      useBuildOrderAccount();
      return game.steps;
    },
  };
});
vi.mock("@/ui/features/world/containers/left-facets/use-suggestion-actions", () => ({
  isOrderSuggestion: (step: { action: string }) => step.action !== "upgrade",
  useSuggestionActions: () => ({ handleSuggestionClick: game.build, pendingSuggestionIds: [] }),
}));
vi.mock("@/ui/modules/entity-details/hooks/use-realm-level-up", () => ({
  useRealmLevelUp: () => ({
    mode: "level-up",
    word: "Level up to Kingdom",
    nextLevelName: "Kingdom",
    ready: true,
    loading: false,
    refusal: null,
    run: game.levelUp,
  }),
}));

// The account 0xa1 is signed in; its build orders' service answers each save at the next revision.
const service = vi.hoisted(() => ({
  saveBuildOrders: vi.fn(async (saved: { owner: string; revision: number; book: unknown }) => ({
    ...saved,
    revision: saved.revision + 1,
  })),
  getBuildOrders: vi.fn(),
  signedIn: true,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
  useIdentitySession: () =>
    service.signedIn
      ? { status: "signed-in", session: { user: { realmsId: "0xa1" } } }
      : { status: "signed-out", session: null },
}));

import { useActiveBuildOrder, useBuildOrderStore } from "@/hooks/use-build-orders";
import { BuildOrderPanel } from "./build-order-panel";

const WOOD = {
  id: "1-build-wood",
  realmId: 1,
  realmName: "Egonal",
  action: "build",
  label: "Build wood camp",
  reason: "Wood: 1 of 2 built.",
  icon: "wood",
};
const LEVEL_UP = {
  id: "2-upgrade",
  realmId: 2,
  realmName: "Stolsli",
  action: "upgrade",
  label: "Level up realm",
  reason: "It can level up now.",
  icon: "upgrade",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(game, { mode: "blitz", ordersAllowed: true, steps: [WOOD, LEVEL_UP] });
  game.build.mockClear();
  service.saveBuildOrders.mockClear();
  service.getBuildOrders.mockReset();
  service.signedIn = true;
  useBuildOrderStore.setState({
    owner: "0xa1",
    status: "ready",
    book: { orders: [], active: null },
    revision: 3,
    notice: null,
  });
  game.levelUp.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const draw = () => act(async () => root.render(<BuildOrderPanel />));
const rows = () =>
  [...host.querySelectorAll(".ui-row")].map((row) => [
    row.querySelector(".ui-row__title")?.textContent,
    row.querySelector(".ui-row__detail")?.textContent,
    row.querySelector("button")?.textContent,
  ]);

it("shows each realm's next step under the default order, the level a level-up reaches in its line, and each verb takes it", async () => {
  await draw();
  expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Build order");
  expect(host.querySelector(".ui-select")?.textContent).toBe("The game's order");
  expect(rows()).toEqual([
    ["Egonal", "Wood: 1 of 2 built.", "Build"],
    ["Stolsli", "It can level up to Kingdom now.", "Level up"],
  ]);
  const [build, levelUp] = [...host.querySelectorAll<HTMLButtonElement>(".ui-row button")];
  await act(async () => build.click());
  await act(async () => levelUp.click());
  expect(game.build).toHaveBeenCalledWith(WOOD);
  expect(game.levelUp).toHaveBeenCalledTimes(1);
});

it("says when no realm has a step it can take now", async () => {
  game.steps = [];
  await draw();
  expect(rows()).toEqual([]);
  expect(host.textContent).toContain("Nothing to build now");
});

it("draws nothing where there is no build order to follow: outside a Blitz, or for a viewer who gives no orders", async () => {
  game.mode = "frontier";
  await draw();
  expect(host.innerHTML).toBe("");
  Object.assign(game, { mode: "blitz", ordersAllowed: false });
  await draw();
  expect(host.innerHTML).toBe("");
});

it("chooses which saved order to follow, saving only that choice, and opens the app's Build orders page to make one", async () => {
  const COAL_RUSH = { name: "Coal rush", steps: [{ rank: 0, goal: "farm" as const, count: 2 }] };
  useBuildOrderStore.setState({ book: { orders: [{ id: "o1", order: COAL_RUSH }], active: null } });
  const opened = vi.spyOn(window, "open").mockReturnValue(null);
  await draw();
  const choice = host.querySelector<HTMLButtonElement>('button[aria-label="Order to follow"]')!;
  await act(async () => choice.click());
  const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  expect(items.map((item) => [item.textContent, item.getAttribute("aria-checked")])).toEqual([
    ["Coal rush", "false"],
    ["The game's order", "true"],
  ]);
  await act(async () => items[0].click());
  expect(service.saveBuildOrders.mock.calls[0][0]).toMatchObject({
    revision: 3,
    book: { orders: [{ id: "o1", order: { name: "Coal rush" } }], active: "o1" },
  });
  expect(choice.textContent).toBe("Coal rush");
  // No editor in the game: the pencil opens the page where orders are made, beside the game.
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Make build orders"]')!.click());
  expect(opened).toHaveBeenCalledWith("/blitz/build-orders", "_blank", "noopener");
  opened.mockRestore();
});

it("holds the choice on the game's order while signed out", async () => {
  service.signedIn = false;
  useBuildOrderStore.setState({ owner: null, status: "signed-out", book: null, revision: 0 });
  await draw();
  expect(service.getBuildOrders).not.toHaveBeenCalled();
  const choice = host.querySelector<HTMLButtonElement>('button[aria-label="Order to follow"]')!;
  expect([choice.textContent, choice.disabled]).toEqual(["The game's order", true]);
});

it("reads the account's orders again when the player returns from the Build orders page's tab, and follows what was saved there", async () => {
  // The game's tab holds the book it read, before the player made an order in the page's tab.
  useBuildOrderStore.setState({ book: { orders: [], active: null }, revision: 3 });
  let followed = "";
  const Followed = () => {
    followed = useActiveBuildOrder()?.name ?? "";
    return null;
  };
  await act(async () =>
    root.render(
      <>
        <BuildOrderPanel />
        <Followed />
      </>,
    ),
  );
  const choice = () => host.querySelector<HTMLButtonElement>('button[aria-label="Order to follow"]')!;
  expect([choice().textContent, followed]).toEqual(["The game's order", "Default"]);

  // Saved in the other tab: Coal rush made and followed, at revision 5.
  const saved = {
    orders: [{ id: "o1", order: { name: "Coal rush", steps: [{ rank: "Settlement", goal: "farm", count: 2 }] } }],
    active: "o1",
  };
  service.getBuildOrders.mockResolvedValue({ owner: "0xa1", revision: 5, book: saved });
  // Back on the game: its tab shown again, then focused; one read, not two.
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect([choice().textContent, followed]).toEqual(["Coal rush", "Coal rush"]);

  // The next choice goes over the book read, at its revision.
  await act(async () => choice().click());
  const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  await act(async () => items[1].click());
  expect(service.saveBuildOrders.mock.calls[0][0]).toMatchObject({
    owner: "0xa1",
    revision: 5,
    book: { active: null },
  });
});

it("never takes another account's orders on a return to the tab", async () => {
  useBuildOrderStore.setState({ book: { orders: [], active: null }, revision: 3 });
  service.getBuildOrders.mockResolvedValue({
    owner: "0xb2",
    revision: 9,
    book: { orders: [{ id: "x", order: { name: "Not mine", steps: [] } }], active: "x" },
  });
  await draw();
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(host.querySelector('button[aria-label="Order to follow"]')?.textContent).toBe("The game's order");
  expect(useBuildOrderStore.getState()).toMatchObject({ owner: "0xa1", revision: 3, status: "error" });
  expect(host.querySelector(".ui-notice")?.textContent).toBe("Account changed. Reload your build orders.Try again");
});

it("says when the account's orders cannot be read, with Try again, and follows no order until they are", async () => {
  // The account's first read failed: no book, and the panel's steps (none: no order is followed) wait on it.
  useBuildOrderStore.setState({
    status: "error",
    book: null,
    revision: 0,
    notice: "Your build orders could not be reached.",
  });
  game.steps = [];
  let followed: string | null = "";
  const Followed = () => {
    followed = useActiveBuildOrder()?.name ?? null;
    return null;
  };
  await act(async () =>
    root.render(
      <>
        <BuildOrderPanel />
        <Followed />
      </>,
    ),
  );
  expect(followed).toBeNull();
  const notice = host.querySelector(".ui-notice");
  expect(notice?.textContent).toBe("Your build orders could not be reached.Try again");
  expect(host.textContent).not.toContain("Nothing to build now");

  service.getBuildOrders.mockResolvedValue({ owner: "0xa1", revision: 4, book: { orders: [], active: null } });
  await act(async () => notice!.querySelector("button")!.click());
  expect(service.getBuildOrders).toHaveBeenCalledTimes(1);
  expect(host.querySelector(".ui-notice")).toBeNull();
  expect(followed).toBe("Default");
});
