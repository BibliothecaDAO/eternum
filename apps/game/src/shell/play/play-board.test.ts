import { describe, expect, it } from "vitest";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { gameKey, playBoard, type PlayBoardFacts } from "./play-board";

const REALM = { category: 1, realm_id: 3098, level: 1 } as NonNullable<
  DirectoryGame["player_state"]
>["structures"][number];

const game = (mode: DirectoryGame["mode"], over: Partial<DirectoryGame> = {}): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: 1,
    name: `${mode}-1`,
    mode,
    status: "Live",
    ready: true,
    expedition: null,
    clock: { start_settling_at: 0, start_main_at: 100, end_at: 9_000, end_grace_seconds: 0 },
    player_count: 10,
    roster_count: 0,
    player_state: { registered: false, settled: false, roster_wallet: null, held_realm_id: null, structures: [] },
    ...over,
  }) as DirectoryGame;

const withRealm = (base: DirectoryGame): DirectoryGame => ({
  ...base,
  player_state: { registered: true, settled: true, roster_wallet: null, held_realm_id: null, structures: [REALM] },
});

const gameRow = (id: number, action: BlitzRow["action"], startsAt: number | null = null): BlitzRow => ({
  kind: "game",
  key: `game:0xa:${id}`,
  game: game("blitz", { game_id: id }),
  startsAt,
  seats: { filled: 12, total: 24 },
  action,
});

const slotRow = (name: string): BlitzRow => ({
  kind: "slot",
  key: `slot:${name}`,
  slot: { slotId: 3, chainId: "0xa", name, closesAt: new Date(2_000_000).toISOString(), frozenAt: null, closed: false },
  closesAt: 2_000,
  startsAt: 2_300,
  action: "open",
});

const facts = (over: Partial<PlayBoardFacts>): PlayBoardFacts => ({
  signedIn: true,
  games: [],
  blitz: [],
  finished: [],
  seenResults: new Set(),
  ...over,
});

const frontier = game("frontier", { game_id: 2 });
const endedSeason = withRealm(game("frontier", { game_id: 3, status: "Ended" }));
const finishedBlitz = game("blitz", { game_id: 9, status: "Settled" });

/** The lead as "mode verb", the way the player sees it: "blitz enter", "frontier play". */
const leadOf = (input: PlayBoardFacts) => {
  const { lead } = playBoard(input);
  return lead ? `${lead.mode} ${lead.verb ?? "—"}` : "none";
};

describe("the lead: the one gold verb, first match wins", () => {
  it.each<[string, PlayBoardFacts, string]>([
    [
      "a Blitz seat in a live game: Enter, before a Frontier day",
      facts({ games: [withRealm(frontier)], blitz: [gameRow(7, "enter")] }),
      "blitz enter",
    ],
    [
      "a Frontier day under way: Resume",
      facts({ games: [withRealm(frontier)], blitz: [gameRow(7, "spectate")] }),
      "frontier resume",
    ],
    [
      "a season over and unseen, with no season live: Results",
      facts({ games: [endedSeason], blitz: [gameRow(7, "spectate")] }),
      "frontier results",
    ],
    [
      "a Blitz of theirs finished and unseen, with no season to play: Results",
      facts({ finished: [finishedBlitz], blitz: [gameRow(7, "spectate")] }),
      "blitz results",
    ],
    [
      "no realm in the live season, with a result unseen: Play the season first, as with no result",
      facts({ games: [frontier, endedSeason], finished: [finishedBlitz] }),
      "frontier play",
    ],
    ["signed in with no realm: Play", facts({ games: [frontier] }), "frontier play"],
    [
      "signed out: Play (free), never a result",
      facts({ signedIn: false, games: [frontier, endedSeason] }),
      "frontier play",
    ],
    [
      "no Frontier season: a Blitz to join first",
      facts({ blitz: [gameRow(7, "spectate"), slotRow("s")] }),
      "blitz join",
    ],
    ["no season and no slot: a Blitz to watch", facts({ blitz: [gameRow(7, "spectate")] }), "blitz watch"],
    ["nothing live: Eternum's opening", facts({ games: [game("eternum", { status: "Registration" })] }), "eternum —"],
    ["nothing live or scheduled: no lead", facts({}), "none"],
  ])("%s", (_case, input, lead) => {
    expect(leadOf(input)).toBe(lead);
  });

  it("keeps an unseen result under the season to play in its age's column, never off the board", () => {
    const board = playBoard(facts({ games: [frontier], finished: [finishedBlitz], blitz: [gameRow(7, "spectate")] }));
    expect(board.lead?.mode).toBe("frontier");
    expect(board.ages.blitz.map((item) => `${item.when} ${item.verb}`)).toEqual(["now watch", "done results"]);
  });

  it("opens a seated game still being prepared on its lobby, and offers Enter once it is ready", () => {
    const preparing = facts({ games: [frontier], blitz: [gameRow(10, "registered", 3_000)] });
    expect(leadOf(preparing)).toBe("blitz lobby");
    expect(leadOf(facts({ games: [frontier], blitz: [gameRow(10, "enter")] }))).toBe("blitz enter");
  });

  it("does not resume a season that has not started its days", () => {
    expect(leadOf(facts({ games: [withRealm({ ...frontier, status: "Registration" })] }))).toBe("frontier play");
  });
});

describe("everything else, each game once", () => {
  const board = playBoard(
    facts({
      games: [withRealm(frontier), game("eternum", { game_id: 5, status: "Registration" })],
      blitz: [gameRow(7, "enter"), gameRow(8, "spectate"), slotRow("next"), gameRow(10, "registered", 3_000)],
      finished: [finishedBlitz],
    }),
  );
  const keys = (items: readonly { key: string }[]) => items.map((item) => item.key);

  it("leads with the seat to enter, and keeps each age's other games under it, those under way now first", () => {
    expect(board.lead?.key).toBe("game:0xa:7");
    expect(board.ages.blitz.map((item) => `${item.when} ${item.verb}`)).toEqual([
      "now watch",
      "next join",
      "next lobby",
      "done results",
    ]);
    expect(keys(board.ages.blitz)).toEqual(["game:0xa:8", "slot:next", "game:0xa:10", gameKey(finishedBlitz)]);
    expect(board.ages.frontier.map((item) => `${item.when} ${item.verb}`)).toEqual(["now resume"]);
    expect(keys(board.ages.eternum)).toEqual(["0xa:5"]);
  });

  it("never shows a game twice", () => {
    const all = [board.lead!, ...Object.values(board.ages).flat()];
    expect(new Set(keys(all)).size).toBe(all.length);
  });
});
