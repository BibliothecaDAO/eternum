import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

import {
  boardRows,
  type GloryIdentity,
  gloryRowOf,
  mergeAspectRosters,
  nativeAspectRoster,
  nativeMember,
  type OwnGloryRow,
} from "@/shell/season-tab/glory-rows";
import type { RaceMemberRow } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type AspectId } from "@bibliothecadao/types";
import { SeasonLeaderboard } from "./season-leaderboard";

const ASPECTS = [1, 2, 3, 4] as const;
const OWN = 7n;

const member = (home: number, glory: number): RaceMemberRow => ({
  home: BigInt(home),
  glory: BigInt(glory) * BigInt(RESOURCE_PRECISION),
  contribution: BigInt(glory) * BigInt(RESOURCE_PRECISION),
  mine: BigInt(home) === OWN,
});

const identityOf = (home: bigint): GloryIdentity => ({
  owner: `0x${(0x100n + home).toString(16)}`,
  realm_id: Number(home),
});

const nativeRosters = (
  native: Record<AspectId, RaceMemberRow[]>,
  named: (home: bigint) => GloryIdentity | null = identityOf,
) => ASPECTS.map((aspect) => ({ aspect, roster: nativeAspectRoster(native[aspect], named) }));

const ownRow = (native: Record<AspectId, RaceMemberRow[]>, place: number): OwnGloryRow => {
  const aspectPlace = native[1].findIndex((row) => row.mine) + 1;
  return { aspect: 1, member: nativeMember(aspectPlace, native[1][aspectPlace - 1]!, identityOf)!, place, aspectPlace };
};

const SMALL: Record<AspectId, RaceMemberRow[]> = {
  1: [member(9, 3750), member(7, 1250)],
  2: [member(11, 2100), member(12, 640)],
  3: [member(13, 1800)],
  4: [],
};

it("gives the game, ranked from native rows, the same board rows the app builds from Herald's roster", () => {
  const served = ASPECTS.map((aspect) => ({
    aspect,
    roster: {
      total: SMALL[aspect].length,
      members: SMALL[aspect].slice(0, 10).map((row, index) => nativeMember(index + 1, row, identityOf)!),
    },
  }));
  const app = mergeAspectRosters(served).rows.map(({ rank, member: row, aspect }) =>
    gloryRowOf(rank, row, row.entity_id === String(OWN), aspect),
  );
  const game = boardRows(nativeRosters(SMALL), 0, ownRow(SMALL, 4));
  expect(game).toEqual(app);
  expect(game.map(({ key, rank, own }) => [key, rank, own])).toEqual([
    ["9", 1, false],
    ["11", 2, false],
    ["13", 3, false],
    ["7", 4, true],
    ["12", 5, false],
  ]);
});

it("keeps each Aspect's top ten that a source names, and adds the player's own row last with their place", () => {
  const crowd = Array.from({ length: 12 }, (_, index) => member(100 + index, 5000 - index * 100));
  const native: Record<AspectId, RaceMemberRow[]> = { 1: [...crowd, member(7, 40)], 2: [member(21, 60)], 3: [], 4: [] };
  const rows = boardRows(
    nativeRosters(native, (home) => (home === 21n ? null : identityOf(home))),
    0,
    ownRow(native, 14),
  );
  expect(rows.map(({ key }) => key)).toEqual([...crowd.slice(0, 10).map(({ home }) => String(home)), "7"]);
  expect(rows.at(-1)).toMatchObject({ rank: 14, own: true, aspect: 1 });
  expect(boardRows(nativeRosters(native), 1, ownRow(native, 14)).at(-1)).toMatchObject({ rank: 13, own: true });
  expect(boardRows(nativeRosters(native), 2, ownRow(native, 14)).some((row) => row.own)).toBe(false);
});

it("draws one table row for each board row, the player's own lit", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  const own = ownRow(SMALL, 4);
  act(() =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SeasonLeaderboard
            players={5}
            race={[]}
            finishHeight={10_000}
            stages={5}
            result={null}
            rosters={nativeRosters(SMALL)}
            own={own}
            standing={null}
            onClose={() => undefined}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  const drawn = [...host.querySelectorAll(".ui-table-row")];
  const rows = boardRows(nativeRosters(SMALL), 0, own);
  expect(drawn).toHaveLength(rows.length);
  expect(drawn.map((row) => row.hasAttribute("data-own"))).toEqual(rows.map((row) => row.own));
  act(() => root.unmount());
});
