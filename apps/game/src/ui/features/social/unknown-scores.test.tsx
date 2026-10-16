import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRow } from "./guilds/guild-list";
import { PlayerList, type PlayerCustom, type VictoryPointGrants } from "./player/player-list";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showGuildsTab: false } }),
}));
vi.mock("@/hooks/use-player-profile", () => ({ playerAvatarUrl: () => null }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("./player/use-leaderboard-effects", () => ({
  useLeaderboardEffects: () => ({ effects: new Map(), rowRefs: { current: new Map() } }),
}));

const player: PlayerCustom = {
  entity: "0x1",
  address: 1n,
  name: "Unseen player",
  points: null,
  rank: Number.MAX_SAFE_INTEGER,
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
  activityBreakdown: null,
  includesLiveShareholderPoints: false,
};

const grants: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 300,
  claimHyperstructureFromBandits: 1_500,
  hyperstructurePerRealmPerSecond: 2,
};

describe("the leaderboard's columns", () => {
  it("name each activity's points under its column, where the points it counts are", () => {
    const html = renderToStaticMarkup(
      <PlayerList
        players={[player]}
        grants={grants}
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    const header = html.slice(0, html.indexOf("Unseen player"));
    for (const [column, grant] of [
      ["Tiles", "5 each"],
      ["Crates", "250 each"],
      ["Rifts/Camps", "300 each"],
      ["HS Taken", "1.5K each"],
      ["HS Held", "2/s a realm"],
    ]) {
      expect(header).toContain(`<span>${column}</span><span class="text-xs font-normal text-gold/55">${grant}</span>`);
    }
  });
});

describe("unknown subscription scores", () => {
  it("shows a dash for a player's unknown score without giving a rank", () => {
    const html = renderToStaticMarkup(
      <PlayerList
        players={[player]}
        grants={grants}
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    expect(html).toContain("Unseen player");
    expect(html).toContain("—");
    expect(html).not.toMatch(/>#[0-9]+</);
    expect(html).not.toContain("NaN");
  });

  it("shows dashes for a guild's unknown score, rank and prizes", () => {
    const html = renderToStaticMarkup(
      <GuildRow
        guild={{
          entityId: 1n,
          name: "Unseen guild",
          isOwner: false,
          memberCount: 2,
          points: null,
          rank: null,
          prize: null,
          realms: 2,
          mines: 0,
          hyperstructures: 0,
          structureCount: 2,
        }}
        onClick={() => {}}
      />,
    );
    expect(html.match(/—/g)).toHaveLength(4);
    expect(html).not.toMatch(/>#[0-9]+</);
    expect(html).not.toContain("NaN");
  });
});
