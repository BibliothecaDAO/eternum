import { describe, expect, it } from "vitest";

import type { BlitzRow } from "../blitz-rows";
import type { DirectoryGame } from "../herald";
import { ageOfStep, gameKey, type NextStep, nextStep } from "./next-step";

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
    player_state: { registered: false, settled: false, roster_member: false, structures: [] },
    ...over,
  }) as DirectoryGame;

const withRealm = (base: DirectoryGame): DirectoryGame => ({
  ...base,
  player_state: { registered: true, settled: true, roster_member: false, structures: [REALM] },
});

const blitzRow = (action: BlitzRow["action"], startsAt: number | null = null): BlitzRow => ({
  kind: "game",
  key: "game:0xa:7",
  game: game("blitz", { game_id: 7 }),
  startsAt,
  seats: { filled: 12, total: 24 },
  action,
});

const facts = (over: Partial<Parameters<typeof nextStep>[0]>) => ({
  signedIn: true,
  games: [] as DirectoryGame[],
  blitz: [] as BlitzRow[],
  seenResults: new Set<string>(),
  ...over,
});

const frontier = game("frontier", { game_id: 2 });
const ended = withRealm(game("frontier", { game_id: 3, status: "Ended" }));

describe("the home card's table, first match wins", () => {
  it.each<[string, Parameters<typeof nextStep>[0], NextStep["kind"]]>([
    [
      "a Blitz seat in a live game: Enter, before a Frontier day",
      facts({ games: [withRealm(frontier)], blitz: [blitzRow("enter")] }),
      "enter",
    ],
    [
      "a Frontier day under way: Resume",
      facts({ games: [withRealm(frontier)], blitz: [blitzRow("spectate")] }),
      "resume",
    ],
    ["a season over and unseen: Results", facts({ games: [frontier, ended] }), "results"],
    [
      "a season over and already seen: Play the live one",
      facts({ games: [frontier, ended], seenResults: new Set([gameKey(ended)]) }),
      "play",
    ],
    ["signed in with no realm: Play", facts({ games: [frontier] }), "play"],
    ["signed out: Play free", facts({ signedIn: false, games: [frontier, ended] }), "play"],
    ["no Frontier season: the next Blitz", facts({ blitz: [blitzRow("spectate")] }), "blitz"],
    ["nothing live: Eternum's opening", facts({ games: [game("eternum", { status: "Registration" })] }), "eternum"],
    ["nothing live or scheduled: the quiet card", facts({}), "quiet"],
  ])("%s", (_case, input, kind) => {
    expect(nextStep(input).kind).toBe(kind);
  });

  it("marks only the signed-out Play as the first visit", () => {
    expect(nextStep(facts({ signedIn: false, games: [frontier] }))).toMatchObject({ kind: "play", firstVisit: true });
    expect(nextStep(facts({ games: [frontier] }))).toMatchObject({ kind: "play", firstVisit: false });
  });

  it("does not resume a season that has not started its days", () => {
    expect(nextStep(facts({ games: [withRealm({ ...frontier, status: "Registration" })] })).kind).toBe("play");
  });

  it("shows the other three ages beside the card's own", () => {
    expect(ageOfStep({ kind: "enter", row: blitzRow("enter") })).toBe("blitz");
    expect(ageOfStep({ kind: "eternum", game: game("eternum", { status: "Registration" }) })).toBe("eternum");
    expect(ageOfStep(undefined)).toBe("frontier");
  });
});
