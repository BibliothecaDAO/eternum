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

import { IdentityChip } from "./identity-chip";

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
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Identity"]')!.click());
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
  expect(page.textContent).toContain("Your account owns no realm in this game.");
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).not.toContain("Play");
});
