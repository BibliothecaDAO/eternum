import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

// A finished free Blitz watched by one of its two players: both on 0 points, joint first (qa-app-1 P3-11).
vi.mock("@/shell/herald", () => ({ useRealmsPlayer: () => ({ data: "0x5a11" }) }));
const STANDINGS = vi.hoisted(() => ({
  current: new Map([
    ["0xc1", { rank: 1, points: 0 }],
    ["0x5a11", { rank: 1, points: 0 }],
  ]),
}));
vi.mock("@/ui/features/social/player/use-in-game-leaderboard", () => ({
  useInGameLeaderboard: () => ({ standingsByAddress: STANDINGS.current }),
}));
// The other player's realm.
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: () => [{ entity_id: 9n, owner: 0xc1n, base: { category: 1 } }],
}));
// The one name rule, as identity answered: 0xc1 claimed "clientlane".
const NAMES = vi.hoisted(() => ({
  text: (address: string | bigint) => (BigInt(address) === 0xc1n ? "clientlane" : "Lord 0000"),
  reading: () => ({ state: "waiting" as const, text: "…" }),
}));
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerNames: () => NAMES,
}));
// The game's facts: an empty store, a roster written where a case needs one.
const GAME = vi.hoisted(() => ({
  store: undefined as unknown as import("@bibliothecadao/eternum/game-client").NativeFactStore,
}));
vi.mock("@/hooks/context/game-context", async () => {
  const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
  GAME.store = new NativeFactStore();
  return { useGame: () => ({ setup: { store: GAME.store } }) };
});
const OPENED = vi.hoisted(() => ({ onMap: [] as unknown[] }));
vi.mock("@/play/navigation/open-place", () => ({ openOnMap: (...place: unknown[]) => OPENED.onMap.push(place) }));
vi.mock("./top-header/game-clock", () => ({ useGameFinished: () => true }));

import { overrideSpectateIntent } from "@/utils/spectator-session";
import { configManager } from "@bibliothecadao/eternum";
import { hash } from "starknet";

import { SpectatorStandingsBody } from "./spectator-standings";

it("lights only the watching player's row in a tie, as Results does", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<SpectatorStandingsBody />));
  try {
    const rows = [...container.querySelectorAll<HTMLButtonElement>("button.ui-table-row")];
    const read = rows.map((row) => [
      row.firstElementChild?.textContent,
      row.getAttribute("aria-label"),
      row.getAttribute("aria-current"),
    ]);
    expect(read).toEqual([
      ["1", "clientlane: 0 points", null],
      ["1", "You: 0 points", "true"],
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});

it("marks each player's row with their seat while the viewer watches, as their labels on the map", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  const roster = [0x5a11n, 0xc1n].map((account) => ({ account, wallet: account + 1n }));
  GAME.store.applyFacts([
    { model: "BlitzRoster", key: hash.computePoseidonHashOnElements([1]), value: { game_id: 1, players: roster } },
  ]);
  overrideSpectateIntent(true);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<SpectatorStandingsBody />));
  try {
    const marks = [...container.querySelectorAll<HTMLElement>("button.ui-table-row .ui-seat")].map((mark) => [
      mark.textContent,
      mark.style.getPropertyValue("--seat"),
    ]);
    // The roster seats 0x5a11 first and clientlane second, whatever their rank.
    expect(marks).toEqual([
      ["C", "#4aea7d"],
      ["L", "#fd7562"],
    ]);
  } finally {
    overrideSpectateIntent(false);
    await act(async () => root.unmount());
  }
});

it("finds the watching player's place on a long board though they hold no realm, never opening the map", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  // Forty players; the viewer 30th, their last realm lost (only 0xc1 holds one).
  const field = Array.from({ length: 40 }, (_, index) => `0x${(0xa00 + index).toString(16)}`);
  field[29] = "0x5a11";
  STANDINGS.current = new Map(field.map((address, index) => [address, { rank: index + 1, points: 400 - index }]));
  const container = document.createElement("div");
  container.style.overflowY = "auto";
  const root = createRoot(container);
  await act(async () => root.render(<SpectatorStandingsBody />));
  try {
    const rows = [...container.querySelectorAll<HTMLButtonElement>("button.ui-table-row")];
    expect(rows).toHaveLength(40);
    const own = rows[29]!;
    expect([own.ariaLabel, own.disabled, own.getAttribute("aria-disabled")]).toEqual([
      "You: 371 points",
      false,
      "true",
    ]);
    // The head, then the rows, 40 px each in a 400 px area: the 30th place is below.
    Object.defineProperties(container, { scrollTop: { value: 0 }, clientHeight: { value: 400 } });
    container.scrollTo = vi.fn() as unknown as typeof container.scrollTo;
    container.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    [...container.children].forEach((row, index) => {
      Object.defineProperty(row, "offsetHeight", { value: 40 });
      row.getBoundingClientRect = () => ({ top: index * 40, bottom: (index + 1) * 40 }) as DOMRect;
    });
    act(() => own.click());
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
    expect(OPENED.onMap).toEqual([]);
  } finally {
    await act(async () => root.unmount());
  }
});
