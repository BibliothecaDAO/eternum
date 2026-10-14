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
    player_state: { registered: false, settled: false, roster_wallet: null, structures: [] },
    ...over,
  }) as DirectoryGame;

const withRealm = (base: DirectoryGame): DirectoryGame => ({
  ...base,
  player_state: { registered: true, settled: true, roster_wallet: null, structures: [REALM] },
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
    ["a season over and unseen: Results", facts({ games: [frontier, endedSeason] }), "frontier results"],
    [
      "a Blitz of theirs finished and unseen: Results, as for a season",
      facts({ games: [frontier], finished: [finishedBlitz] }),
      "blitz results",
    ],
    [
      "results already opened on this device: Play the live season",
      facts({ games: [frontier, endedSeason], seenResults: new Set([gameKey(endedSeason)]) }),
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

  it("keeps under way now what the lead is not: the day to resume and the game to watch", () => {
    expect(board.lead?.key).toBe("game:0xa:7");
    expect(board.now.map((item) => `${item.mode} ${item.verb}`)).toEqual(["blitz watch", "frontier resume"]);
  });

  it("puts each mode's next and finished games behind its switch, the player's own marked", () => {
    expect(keys(board.later.blitz)).toEqual(["slot:next", "game:0xa:10", gameKey(finishedBlitz)]);
    expect(board.later.blitz.map((item) => item.verb)).toEqual(["join", "lobby", "results"]);
    expect(keys(board.later.eternum)).toEqual(["0xa:5"]);
    expect(board.later.frontier).toEqual([]);
    expect(board.marked).toEqual(["blitz"]);
  });

  it("never shows a game twice", () => {
    const all = [board.lead!, ...board.now, ...Object.values(board.later).flat()];
    expect(new Set(keys(all)).size).toBe(all.length);
  });

  it("opens the switch on the first mode with something to do, else on the first with anything", () => {
    expect(board.openMode).toBe("blitz");
    expect(playBoard(facts({ games: [game("eternum", { status: "Registration" }), frontier] })).openMode).toBe(
      "eternum",
    );
  });
});
