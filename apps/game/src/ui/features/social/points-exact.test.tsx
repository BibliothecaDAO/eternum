import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildBlitzShareMessage } from "@/ui/shared/lib/blitz-highlight";
import type { VictoryPointGrants } from "@/ui/shared/lib/victory-point-grants";
import { GuildRow } from "./guilds/guild-list";
import { PlayerList, type PlayerCustom } from "./player/player-list";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showGuildsTab: false } }),
}));
vi.mock("@/hooks/use-player-profile", () => ({ playerAvatarUrl: () => null }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("./player/use-leaderboard-effects", () => ({
  useLeaderboardEffects: () => ({ effects: new Map(), rowRefs: { current: new Map() } }),
}));

const grants: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 300,
  claimHyperstructureFromBandits: 12_500,
  hyperstructurePerSecond: 2,
  hyperstructureScale: "per-realm",
};

const activity = (entries: Partial<Record<string, { count: number; points: number }>>) =>
  ({
    exploration: { count: 0, points: 0 },
    openRelicChest: { count: 0, points: 0 },
    otherStructureBanditsDefeat: { count: 0, points: 0 },
    hyperStructureBanditsDefeat: { count: 0, points: 0 },
    hyperstructureShare: { count: 0, points: 0 },
    ...entries,
  }) as PlayerCustom["activityBreakdown"];

const player = (name: string, points: number, rank: number, breakdown = activity({})): PlayerCustom => ({
  entity: `0x${rank}`,
  address: BigInt(rank),
  name,
  points,
  rank,
  realms: 1,
  mines: 0,
  hyperstructures: 0,
  villages: 0,
  banks: 0,
  isAlive: true,
  guildName: "",
  isUser: false,
  isInvited: false,
  guild: undefined,
  activityBreakdown: breakdown,
  includesLiveShareholderPoints: false,
  mmrDelta: null,
});

const list = (players: PlayerCustom[]) =>
  renderToStaticMarkup(
    <PlayerList
      players={players}
      grants={grants}
      mmr="off"
      viewPlayerInfo={() => {}}
      whitelistPlayer={() => {}}
      isLoading={false}
    />,
  );

/** The text of every element, in order: what a player reads, one entry per tag. */
const texts = (html: string) =>
  [...html.matchAll(/>([^<]+)</g)].map(([, text]) => text.replace(/&amp;/g, "&").trim()).filter(Boolean);

describe("points on the leaderboard are exact, either side of ten thousand", () => {
  it("writes each total to the unit: 9,999, 10,000 and 12,430, never 10K or 12.4K", () => {
    const read = texts(list([player("A", 12_430, 1), player("B", 10_000, 2), player("C", 9_999, 3)]));
    expect(read).toEqual(expect.arrayContaining(["12,430", "10,000", "9,999"]));
    expect(read.join(" ")).not.toMatch(/\d(\.\d)?K\b/);
  });

  it("writes an activity's points exact with its count, and without one once the count is gone", () => {
    const read = texts(
      list([
        player(
          "Holder",
          50_000,
          1,
          activity({
            openRelicChest: { count: 1, points: 12_430 },
            hyperStructureBanditsDefeat: { count: 0, points: 10_000 },
            hyperstructureShare: { count: 0, points: 12_430 },
            exploration: { count: 0, points: 1 },
          }),
        ),
      ]),
    );
    expect(read).toEqual(expect.arrayContaining(["1 · 12,430 points", "10,000 points", "12,430 points", "1 point"]));
    expect(read.join(" ")).not.toMatch(/\d(\.\d)?K\b/);
  });

  it("names each activity's grant exact under its column, ten thousand and up included", () => {
    expect(texts(list([player("A", 1, 1)]))).toContain("12,500 each");
  });
});

describe("a guild's score and a shared result", () => {
  it.each([
    [9_999, "9,999"],
    [10_000, "10,000"],
    [12_430, "12,430"],
  ])("a guild with %i points reads %s", (points, written) => {
    const html = renderToStaticMarkup(
      <GuildRow
        guild={{
          entityId: 1n,
          name: "Guild",
          isOwner: false,
          memberCount: 2,
          points,
          rank: 1,
          prize: null,
          realms: 2,
          mines: 0,
          hyperstructures: 0,
          structureCount: 2,
        }}
        onClick={() => {}}
      />,
    );
    expect(texts(html)).toContain(written);
  });

  it.each([
    [10_000, "with 10,000 points"],
    [12_430, "with 12,430 points"],
    [0, "with 0 points"],
  ])("a Blitz result shared with %i points says %s", (points, says) => {
    expect(buildBlitzShareMessage({ rank: 1, points })).toContain(says);
  });
});
