import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The signed-in player's account on this shard, known from the session alone; they joined nothing while spectating.
const PLAYER = "0x5a11";
const view = vi.hoisted(() => ({ structures: [] as { owner: bigint; base: { category: number } }[] }));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({
    status: "signed-in",
    session: { user: { id: "0xabc", realmsId: "0xabc", name: "Maelis" } },
  }),
}));
vi.mock("@/shell/herald", () => ({ useRealmsPlayer: () => ({ data: PLAYER }) }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => view.structures }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayers: () => [] }));
vi.mock("@/ui/features/social/player/use-in-game-leaderboard", () => ({
  useInGameLeaderboard: () => ({ standingsByAddress: new Map() }),
}));
vi.mock("@/ui/features/social/components/social-board", () => ({
  LEADERBOARD_POPOVER_ID: "leaderboard",
  LeaderboardSurface: () => null,
}));

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { overrideSpectateIntent, resolveSpectateIntent } from "@/utils/spectator-session";
import { StructureType } from "@bibliothecadao/types";

import { IdentityChip, playerReadings } from "./identity-chip";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
  overrideSpectateIntent(false);
  usePopoverStore.setState({ openId: null });
});

const openChip = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <IdentityChip />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Account"]')!.click());
  return document.body;
};

it("offers Play to a spectator whose account owns realms in this game, before any account is joined", async () => {
  resolveSpectateIntent({ search: "?spectate=true" });
  view.structures = [1, 2, 3].map(() => ({ owner: BigInt(PLAYER), base: { category: StructureType.Realm } }));
  const page = await openChip();
  expect(page.textContent).toContain("Spectating this game.");
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).toContain("Play");
  expect(page.textContent).not.toContain("owns no realm");
});

it("says a spectator's account owns no realm here when none of the game's structures is theirs", async () => {
  resolveSpectateIntent({ search: "?spectate=true" });
  view.structures = [{ owner: 0x77n, base: { category: StructureType.Realm } }];
  const page = await openChip();
  expect(page.textContent).toContain("You hold no realm here.");
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).not.toContain("Play");
});

// The top line as a player reads it, one reading a cell: the score once, its noun once ("35 points", never "35 points
// points"), and "1 point" for one.
it.each([
  { points: 35, reads: "35 points" },
  { points: 1, reads: "1 point" },
  { points: 0, reads: "0 points" },
])("writes a score of $points as '$reads' on the top line", async ({ points, reads }) => {
  const TopLine = () => <p>{playerReadings("clientlane", { rank: 1, points })}</p>;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const root = createRoot(container);
  await act(async () => root.render(<TopLine />));
  unmount = () => act(async () => root.unmount());
  expect([...container.querySelector("p")!.children].map((cell) => cell.textContent)).toEqual([
    "clientlane",
    `#1 · ${reads}`,
  ]);
});
