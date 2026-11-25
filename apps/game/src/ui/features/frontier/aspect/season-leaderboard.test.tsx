import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { gloryBoardEntry } from "@/shell/season-tab/aspect-roster";
import {
  type GloryIdentity,
  gloryRowOf,
  mergeAspectRosters,
  nativeAspectRoster,
  nativeMember,
} from "@/shell/season-tab/glory-rows";
import { AppBoard } from "@/ui/design-system/kit/app-elements";
import { YOU } from "@/ui/design-system/kit/words";
import type { RaceMemberRow } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type AspectId } from "@bibliothecadao/types";
import { SeasonLeaderboard, type SeasonLeaderboardProps } from "./season-leaderboard";

vi.mock("@/hooks/use-player-profile", async (original) => ({
  ...(await original<typeof import("@/hooks/use-player-profile")>()),
  usePlayerName: (account: string | bigint | null | undefined) =>
    account === null || account === undefined
      ? null
      : { state: "named", text: `Lord ${BigInt(account).toString(16)}`, claimed: true },
  usePlayerProfile: () => ({ name: null, portrait: null }),
}));

const ASPECTS = [1, 2, 3, 4] as const;
const OWN = 7n;

const member = (home: number, glory: number): RaceMemberRow => ({
  home: BigInt(home),
  glory: BigInt(glory) * BigInt(RESOURCE_PRECISION),
  contribution: BigInt(glory) * BigInt(RESOURCE_PRECISION),
  mine: BigInt(home) === OWN,
});

const identityOf = (home: bigint): GloryIdentity => ({ owner: `0x${(0x100n + home).toString(16)}`, realm_id: Number(home) });
const lordOf = (home: bigint) => `Lord ${(0x100n + home).toString(16)}`;

const herald = (members: readonly RaceMemberRow[]) => ({
  total: members.length,
  members: members.slice(0, 10).map((row, index) => nativeMember(index + 1, row, identityOf)!),
});

const rowsIn = (node: ReactNode, row: string): string[] => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  const rows = [...host.querySelectorAll(row)].map((each) => each.textContent ?? "");
  act(() => root.unmount());
  return rows;
};

const gameBoard = (
  native: Record<AspectId, RaceMemberRow[]>,
  named: (home: bigint) => GloryIdentity | null,
  own: SeasonLeaderboardProps["own"],
) => (
  <SeasonLeaderboard
    players={ASPECTS.reduce((sum, aspect) => sum + native[aspect].length, 0)}
    race={[]}
    finishHeight={10_000}
    stages={5}
    result={null}
    rosters={ASPECTS.map((aspect) => ({ aspect, roster: nativeAspectRoster(native[aspect], named) }))}
    own={own}
    standing={null}
    onClose={() => undefined}
  />
);

it("ranks and draws the same members alike in the game, from native ranks, and in the app, from Herald's roster", () => {
  const native: Record<AspectId, RaceMemberRow[]> = {
    1: [member(9, 3750), member(7, 1250)],
    2: [member(11, 2100), member(12, 640)],
    3: [member(13, 1800)],
    4: [],
  };
  const served = ASPECTS.map((aspect) => ({ aspect, roster: herald(native[aspect]) }));
  const app = rowsIn(
    <AppBoard
      rows={9}
      entries={mergeAspectRosters(served).rows.map(({ rank, member: row, aspect }) =>
        gloryBoardEntry(gloryRowOf(rank, row, row.entity_id === String(OWN), aspect), () => undefined),
      )}
    />,
    ".app-board__item",
  );
  const own = { aspect: 1 as const, member: nativeMember(2, native[1][1]!, identityOf)!, place: 4, aspectPlace: 2 };
  const game = rowsIn(gameBoard(native, identityOf, own), ".ui-table-row");
  expect(game).toHaveLength(5);
  expect(game).toEqual(app);
});

it("draws each Aspect's top ten that a source names, and holds the player's own row at the foot with their place", () => {
  const crowd = Array.from({ length: 12 }, (_, index) => member(100 + index, 5000 - index * 100));
  const native: Record<AspectId, RaceMemberRow[]> = { 1: [...crowd, member(7, 40)], 2: [member(21, 60)], 3: [], 4: [] };
  const unnamed = (home: bigint) => (home === 21n ? null : identityOf(home));
  const own = { aspect: 1 as const, member: nativeMember(13, native[1][12]!, identityOf)!, place: 14, aspectPlace: 13 };
  const rows = rowsIn(gameBoard(native, unnamed, own), ".ui-table-row");
  expect(rows).toHaveLength(11);
  expect(rows[0]).toContain(lordOf(100n));
  expect(rows.some((row) => row.includes(lordOf(110n)))).toBe(false);
  expect(rows.some((row) => row.includes(lordOf(21n)))).toBe(false);
  expect(rows.at(-1)?.startsWith(`14${YOU}`)).toBe(true);
});
