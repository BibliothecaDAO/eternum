// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuildRow } from "./guilds/guild-list";
import { PlayerList, type PlayerCustom } from "./player/player-list";
import type { VictoryPointGrants } from "@/ui/shared/lib/victory-point-grants";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ ui: { showGuildsTab: false } }),
}));
vi.mock("@/hooks/use-player-profile", () => ({ playerAvatarUrl: () => null }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("./player/use-leaderboard-effects", () => ({
  useLeaderboardEffects: () => ({ effects: new Map(), rowRefs: { current: new Map() } }),
}));

/** The rendered markup as a document, to read what a player sees. */
const dom = (html: string) => new DOMParser().parseFromString(html, "text/html");

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
  mmrDelta: null,
};

const grants: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 300,
  claimHyperstructureFromBandits: 1_500,
  hyperstructurePerSecond: 2,
  hyperstructureScale: "per-realm",
};

describe("the leaderboard's columns", () => {
  it("name each activity's points under its column, where the points it counts are", () => {
    const html = renderToStaticMarkup(
      <PlayerList
        players={[player]}
        grants={grants}
        mmr="off"
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    // Each column's lines, as its header cell reads them: its title, then the points it grants.
    const columns = [...dom(html).querySelectorAll(".ui-table-head > div")].map((cell) =>
      [...cell.children].map((line) => line.textContent),
    );
    expect(columns).toEqual([
      ["Rank"],
      ["Name"],
      ["Tiles", "5 each"],
      ["Crates", "250 each"],
      ["Camps & Rifts", "300 each"],
      ["HS taken", "1,500 each"],
      ["HS held", "x/s"],
      ["Points"],
    ]);
  });
});

describe("the scoring rules on a phone", () => {
  it("give every activity's points in one line, where the activity columns are hidden", () => {
    const html = renderToStaticMarkup(
      <PlayerList
        players={[player]}
        grants={grants}
        mmr="off"
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    expect(dom(html).querySelector('[aria-label="Scoring rules"]')?.textContent).toBe(
      "Tiles 5 each · Crates 250 each · Camps & Rifts 300 each · HS taken 1,500 each · HS held x/s",
    );
  });
});

describe("the MMR column", () => {
  const rows = (mmr: "off" | "ready" | "unavailable", players: PlayerCustom[]) =>
    renderToStaticMarkup(
      <PlayerList
        players={players}
        grants={grants}
        mmr={mmr}
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );

  it("shows each player's gain or loss if the game ended now, and is absent from an unrated game", () => {
    const players = [
      { ...player, address: 1n, name: "Winner", points: 900, rank: 1, mmrDelta: 26 },
      { ...player, address: 2n, name: "Middle", points: 500, rank: 2, mmrDelta: 0 },
      { ...player, address: 3n, name: "Loser", points: 100, rank: 3, mmrDelta: -11 },
      { ...player, address: 4n, name: "Unanswered", points: 0, rank: 4, mmrDelta: null },
    ];
    const rated = rows("ready", players);
    const head = [...dom(rated).querySelectorAll(".ui-table-head > div")].at(-1);
    expect([...head!.children].map((line) => line.textContent)).toEqual(["MMR", "if it ended now"]);
    // Each row's last cell is its MMR.
    const cells = [...dom(rated).querySelectorAll(".ui-table-row")].map((row) => row.lastElementChild?.textContent);
    expect(cells).toEqual(["+26", "±0", "−11", "—"]);

    expect(rows("off", players)).not.toContain("MMR");
    expect(rows("unavailable", players)).toContain("unavailable");
  });
});

describe("the player's own row", () => {
  it("names the player as every other row does, with no address under the name", () => {
    const own = { ...player, address: 0x29556aae044f8335n, name: "clientlane", isUser: true, points: 10, rank: 1 };
    const html = renderToStaticMarkup(
      <PlayerList
        players={[own, { ...player, address: 2n, name: "uxplay", points: 5, rank: 2 }]}
        grants={grants}
        mmr="off"
        viewPlayerInfo={() => {}}
        whitelistPlayer={() => {}}
        isLoading={false}
      />,
    );
    expect(html).toContain("clientlane");
    expect(html).not.toContain("0x29556aae044f8335");
  });
});

describe("unknown subscription scores", () => {
  it("shows a dash for a player's unknown score without giving a rank", () => {
    const html = renderToStaticMarkup(
      <PlayerList
        players={[player]}
        grants={grants}
        mmr="off"
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
