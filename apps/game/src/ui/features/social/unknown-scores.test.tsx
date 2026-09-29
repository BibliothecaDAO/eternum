import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
  structures: [],
  isUser: false,
  isInvited: false,
  guild: undefined,
  activityBreakdown: null,
  includesLiveShareholderPoints: false,
};

describe("unknown subscription scores", () => {
  it("shows a dash for a player's unknown score without giving a rank", () => {
    const html = renderToStaticMarkup(
      <PlayerList players={[player]} viewPlayerInfo={() => {}} whitelistPlayer={() => {}} isLoading={false} />,
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
