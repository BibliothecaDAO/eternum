import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { gloryBoardEntry } from "@/shell/season-tab/aspect-roster";
import { gloryRowOf, mergeAspectRosters, nativeAspectRoster } from "@/shell/season-tab/glory-rows";
import { AppBoard } from "@/ui/design-system/kit/app-elements";
import type { RaceMemberRow } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type AspectId } from "@bibliothecadao/types";
import { SeasonLeaderboard } from "./season-leaderboard";

vi.mock("@/hooks/use-player-profile", async (original) => ({
  ...(await original<typeof import("@/hooks/use-player-profile")>()),
  usePlayerName: (account: string | bigint | null | undefined) =>
    account === null || account === undefined
      ? null
      : { state: "named", text: `Lord ${BigInt(account).toString(16)}`, claimed: true },
  usePlayerProfile: () => ({ name: null, portrait: null }),
}));

const glory = (amount: number) => BigInt(amount) * BigInt(RESOURCE_PRECISION);

const home = (entity: number, owner: number, realm: number, amount: number, mine = false): RaceMemberRow => ({
  home: { entity_id: BigInt(entity), owner: BigInt(owner), metadata: { realm_id: realm, order: 0 } } as never,
  glory: glory(amount),
  contribution: glory(amount),
  mine,
});

const NATIVE: Record<AspectId, RaceMemberRow[]> = {
  1: [home(9, 0x222, 12, 3750), home(7, 0x111, 5, 1250, true)],
  2: [home(11, 0x333, 412, 2100), home(12, 0x334, 1033, 640)],
  3: [home(13, 0x335, 2671, 1800)],
  4: [],
};

const herald = (aspect: AspectId) => ({
  total: NATIVE[aspect].length,
  members: NATIVE[aspect].map((member, index) => ({
    rank: index + 1,
    entity_id: member.home.entity_id.toString(),
    realm_id: Number(member.home.metadata.realm_id),
    owner: `0x${member.home.owner.toString(16)}`,
    glory: member.glory.toString(),
  })),
});

const ASPECTS = [1, 2, 3, 4] as const;

const rowsIn = (node: ReactNode, row: string): string[] => {
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

it("ranks and draws the same members alike in the game, from the native store, and in the app, from Herald", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const native = ASPECTS.map((aspect) => ({ aspect, roster: nativeAspectRoster(NATIVE[aspect]) }));
  const served = ASPECTS.map((aspect) => ({ aspect, roster: herald(aspect) }));
  expect(native.map(({ roster }) => roster)).toEqual(served.map(({ roster }) => roster));

  const app = rowsIn(
    <AppBoard
      rows={9}
      entries={mergeAspectRosters(served).rows.map(({ rank, member, aspect }) =>
        gloryBoardEntry(gloryRowOf(rank, member, member.entity_id === "7", aspect), () => undefined),
      )}
    />,
    ".app-board__item",
  );
  const game = rowsIn(
    <SeasonLeaderboard
      players={5}
      race={[]}
      finishHeight={10_000}
      stages={5}
      result={null}
      rosters={native}
      ownEntityId="7"
      standing={null}
      onClose={() => undefined}
    />,
    ".ui-table-row",
  );
  expect(game).toHaveLength(5);
  expect(game).toEqual(app);
});
