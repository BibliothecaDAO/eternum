import { expect, test } from "bun:test";
import { dayOf } from "../../packages/core/src/utils/days";
import { NATIVE_RELEASES } from "./native-release";
import type { GameFacts } from "./game-facts";
import { rehearseTune, type TuneSteps } from "./rehearse-tune";

const CALENDAR = { seed: 5n, startMainAt: 1_000, endAt: 900_000, scheduledEndAt: 900_000, dayUnitSeconds: 100 };

const facts = (release: number, troops = "0x64"): GameFacts => ({
  chain: "0x1",
  world: "0x2",
  schema: "a".repeat(64),
  confirmedBlock: release,
  gameId: 1,
  models: {
    GameRegistry: {
      "0x1": {
        key: { game_id: 1 },
        value: {
          seed: "0x5",
          start_main_at: CALENDAR.startMainAt,
          end_at: CALENDAR.endAt,
          scheduled_end_at: CALENDAR.scheduledEndAt,
          settled: false,
        },
      },
    },
    SliceRules: { "0x1": { key: { game_id: 1 }, value: { day_unit_seconds: CALENDAR.dayUnitSeconds } } },
    GameRelease: { "0x1": { key: { game_id: 1 }, value: { release_id: release, created_release_id: 1 } } },
    ExplorerTroops: { "0x1:0x7": { key: { game_id: 1, explorer_id: 7 }, value: { count: troops } } },
  },
});

function chain(afterTune: GameFacts, lag = 1) {
  let clock = 1_250_000;
  let tuned = false;
  let stale = lag;
  const runs: string[][] = [];
  const steps: TuneSteps = {
    facts: async () => {
      if (!tuned) return facts(NATIVE_RELEASES.frontier.release - 1);
      if (stale-- > 0) return facts(NATIVE_RELEASES.frontier.release - 1);
      return afterTune;
    },
    run: async (argv) => {
      runs.push(argv);
      if (argv[2] === "deploy:cloudflare") tuned = true;
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
  return { steps, runs, start: clock };
}

test("a rehearsal registers the tune, applies it at the game's next day start and reports only the pin moving", async () => {
  const { steps, runs, start } = chain(facts(NATIVE_RELEASES.frontier.release));
  const report = await rehearseTune(steps, 1, "/private", []);
  expect(runs).toEqual([
    ["pnpm", "run", "deploy", "dev"],
    ["pnpm", "run", "deploy:cloudflare", "dev", "/private"],
  ]);
  expect(report.appliedAt).toBe(dayOf(CALENDAR, start / 1000)!.end * 1000);
  expect(dayOf(CALENDAR, report.appliedAt / 1000)!.start * 1000).toBe(report.appliedAt);
  expect(report.releases).toEqual([NATIVE_RELEASES.frontier.release - 1, NATIVE_RELEASES.frontier.release]);
  expect(report.changes.map(({ model, members, expected }) => ({ model, members, expected }))).toEqual([
    { model: "GameRelease", members: ["release_id"], expected: true },
  ]);
  expect(report.unexpected).toBe(0);
});

test("a fact the tune does not name that changed is reported as unexpected", async () => {
  const { steps } = chain(facts(NATIVE_RELEASES.frontier.release, "0x63"));
  const report = await rehearseTune(steps, 1, "/private", []);
  expect(report.unexpected).toBe(1);
  expect(report.changes.find((change) => !change.expected)).toMatchObject({ model: "ExplorerTroops" });
  const named = await rehearseTune(chain(facts(NATIVE_RELEASES.frontier.release, "0x63")).steps, 1, "/private", [
    "ExplorerTroops.count",
  ]);
  expect(named.unexpected).toBe(0);
});

test("a game already on the release refuses before the Cloudflare half applies anything", async () => {
  const { steps, runs } = chain(facts(NATIVE_RELEASES.frontier.release));
  steps.facts = async () => facts(NATIVE_RELEASES.frontier.release);
  await expect(rehearseTune(steps, 1, "/private", [])).rejects.toThrow(
    `already runs release ${NATIVE_RELEASES.frontier.release}`,
  );
  expect(runs).toEqual([["pnpm", "run", "deploy", "dev"]]);
});
