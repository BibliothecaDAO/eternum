import { describe, expect, it } from "vitest";

import type { DirectoryGame } from "../herald";
import { gameKey, holdsNothing, playBoard, type PlayBoardFacts } from "./play-board";

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
    clock_scale: 1,
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
  return lead ? (lead.verb ?? "—") : "none";
};

describe("a rehearsal beside the season", () => {
  const rehearsal = game("frontier", {
    game_id: 4,
    name: "testnet-200",
    clock_scale: 4,
    clock: { ...frontier.clock, start_main_at: 200 },
  });

  it("keeps the real-speed season as the lead and lists the rehearsal under rehearsals", () => {
    const board = playBoard(facts({ games: [rehearsal, frontier] }));
    expect([board.lead?.game.game_id, board.lead?.verb]).toEqual([2, "play"]);
    expect(board.rehearsals.map((item) => [item.game.game_id, item.verb])).toEqual([[4, "play"]]);
  });

  it("resumes the rehearsal where the player holds a realm in it, after their season", () => {
    const board = playBoard(facts({ games: [withRealm(rehearsal), withRealm(frontier)] }));
    expect([board.lead?.game.game_id, board.lead?.verb]).toEqual([2, "resume"]);
    expect(board.rehearsals.map((item) => [item.game.game_id, item.verb])).toEqual([[4, "resume"]]);
  });

  it("lists the real-speed final testnet under rehearsals too: its name, not its speed, says it is not the season", () => {
    const testnet = game("frontier", { game_id: 5, name: "testnet-1795521600", clock_scale: 1 });
    const board = playBoard(facts({ games: [testnet, frontier] }));
    expect([board.lead?.game.game_id, board.lead?.verb]).toEqual([2, "play"]);
    expect(board.rehearsals.map((item) => [item.game.game_id, item.verb])).toEqual([[5, "play"]]);
  });

  it("never places a rehearsal in the lead slot even when it is the only Frontier game, and keeps Play non-empty", () => {
    const board = playBoard(facts({ games: [withRealm(rehearsal)] }));
    expect(board.lead).toBeNull();
    expect(board.rehearsals.map((item) => [item.game.game_id, item.verb])).toEqual([[4, "resume"]]);
    expect(holdsNothing(board)).toBe(false);
  });

  it("never counts an ended rehearsal as a season result or active rehearsal", () => {
    const endedRehearsal = withRealm({ ...rehearsal, status: "Ended" });
    const board = playBoard(facts({ games: [endedRehearsal], finished: [endedRehearsal] }));
    expect(board.lead).toBeNull();
    expect(board.rehearsals).toEqual([]);
    expect(board.results).toEqual([]);
    expect(holdsNothing(board)).toBe(true);
  });
});

describe("the lead: the one gold verb, first match wins", () => {
  it.each<[string, PlayBoardFacts, string]>([
    ["a Frontier day under way: Resume", facts({ games: [withRealm(frontier)] }), "resume"],
    ["a season over and unseen, with no season live: Results", facts({ games: [endedSeason] }), "results"],
    ["a finished Blitz never leads Play", facts({ finished: [finishedBlitz] }), "none"],
    [
      "no realm in the live season, with a result unseen: Play the season first, as with no result",
      facts({ games: [frontier, endedSeason], finished: [finishedBlitz] }),
      "play",
    ],
    ["signed in with no realm: Play", facts({ games: [frontier] }), "play"],
    ["signed out: Play (free), never a result", facts({ signedIn: false, games: [frontier, endedSeason] }), "play"],
    ["a live Blitz in the directory offers nothing", facts({ games: [game("blitz", { game_id: 7 })] }), "none"],
    ["a retired mode never offers entry", facts({ games: [game("eternum", { status: "Registration" })] }), "none"],
    ["nothing live or scheduled: no lead", facts({}), "none"],
  ])("%s", (_case, input, lead) => {
    expect(leadOf(input)).toBe(lead);
  });

  it("does not resume a season that has not started its days", () => {
    expect(leadOf(facts({ games: [withRealm({ ...frontier, status: "Registration" })] }))).toBe("play");
  });
});

describe("everything else, each game once", () => {
  const board = playBoard(
    facts({
      games: [withRealm(frontier), endedSeason, game("eternum", { game_id: 5, status: "Registration" })],
      finished: [finishedBlitz],
    }),
  );
  const keys = (items: readonly { key: string }[]) => items.map((item) => item.key);

  it("leads with the day to resume, keeps unseen ended seasons in results, and excludes Blitz and Eternum", () => {
    expect(board.lead?.key).toBe(gameKey(frontier));
    expect(keys(board.results)).toEqual([gameKey(endedSeason)]);
  });

  it("never shows a game twice and omits seen results", () => {
    const all = [board.lead!, ...board.results];
    expect(new Set(keys(all)).size).toBe(all.length);
    const seen = playBoard(
      facts({
        games: [withRealm(frontier), endedSeason],
        seenResults: new Set([gameKey(endedSeason)]),
      }),
    );
    expect(seen.results).toEqual([]);
  });
});
