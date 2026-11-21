import { describe, expect, it } from "vitest";

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
    expedition: null,
    clock: { start_settling_at: 0, start_main_at: 100, scheduled_end_at: 9_000, end_at: 9_000 },
    player_count: 10,
    player_state: {
      registered: false,
      settled: false,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [],
    },
    ...over,
  }) as DirectoryGame;

const withRealm = (base: DirectoryGame): DirectoryGame => ({
  ...base,
  player_state: {
    registered: true,
    settled: true,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [REALM],
  },
});

const facts = (over: Partial<PlayBoardFacts>): PlayBoardFacts => ({
  signedIn: true,
  games: [],
  finished: [],
  seenResults: new Set(),
  ...over,
});

const frontier = game("frontier", { game_id: 2 });
const endedSeason = withRealm(game("frontier", { game_id: 3, status: "Ended" }));
const finishedBlitz = game("blitz", { game_id: 9, status: "Settled" });

const leadOf = (input: PlayBoardFacts) => {
  const { lead } = playBoard(input);
  return lead ? `${lead.mode} ${lead.verb ?? "—"}` : "none";
};

describe("the lead: the one gold verb, first match wins", () => {
  it.each<[string, PlayBoardFacts, string]>([
    ["a Frontier day under way: Resume", facts({ games: [withRealm(frontier)] }), "frontier resume"],
    ["a season over and unseen, with no season live: Results", facts({ games: [endedSeason] }), "frontier results"],
    [
      "a Blitz of theirs finished and unseen, with no season to play: Results",
      facts({ finished: [finishedBlitz] }),
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
    ["a live Blitz in the directory offers nothing", facts({ games: [game("blitz", { game_id: 7 })] }), "none"],
    ["a retired mode never offers entry", facts({ games: [game("eternum", { status: "Registration" })] }), "none"],
    ["nothing live or scheduled: no lead", facts({}), "none"],
  ])("%s", (_case, input, lead) => {
    expect(leadOf(input)).toBe(lead);
  });

  it("keeps an unseen result under the season to play in its age's column, never off the board", () => {
    const board = playBoard(facts({ games: [frontier], finished: [finishedBlitz] }));
    expect(board.lead?.mode).toBe("frontier");
    expect(board.ages.blitz.map((item) => `${item.when} ${item.verb}`)).toEqual(["done results"]);
  });

  it("does not resume a season that has not started its days", () => {
    expect(leadOf(facts({ games: [withRealm({ ...frontier, status: "Registration" })] }))).toBe("frontier play");
  });
});

describe("everything else, each game once", () => {
  const board = playBoard(
    facts({
      games: [withRealm(frontier), game("eternum", { game_id: 5, status: "Registration" })],
      finished: [finishedBlitz],
    }),
  );
  const keys = (items: readonly { key: string }[]) => items.map((item) => item.key);

  it("leads with the day to resume, and keeps each age's other games under it", () => {
    expect(board.lead?.key).toBe(gameKey(frontier));
    expect(board.ages.blitz.map((item) => `${item.when} ${item.verb}`)).toEqual(["done results"]);
    expect(keys(board.ages.blitz)).toEqual([gameKey(finishedBlitz)]);
    expect(board.ages.frontier).toEqual([]);
    expect(keys(board.ages.eternum)).toEqual([]);
  });

  it("never shows a game twice", () => {
    const all = [board.lead!, ...Object.values(board.ages).flat()];
    expect(new Set(keys(all)).size).toBe(all.length);
  });
});
