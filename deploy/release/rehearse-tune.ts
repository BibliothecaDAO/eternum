#!/usr/bin/env bun
import { dayOf } from "../../packages/core/src/utils/days";
import { NATIVE_RELEASES } from "./native-release";
import { diffFacts, readGameFacts, type FactChange, type GameFacts } from "./game-facts";

const USAGE = "Usage: rehearse-tune.ts <game_id> /absolute/private-directory [--expect Model,Model.member,...]";
const CHECKPOINT_POLL_MS = 30_000;
const CHECKPOINT_WAIT_MS = 30 * 60_000;

export interface TuneSteps {
  facts(gameId: number): Promise<GameFacts>;
  run(argv: string[]): Promise<void>;
  sleep(ms: number): Promise<void>;
  now(): number;
}

export interface TuneRehearsal {
  gameId: number;
  releases: [number, number];
  appliedAt: number;
  changes: FactChange[];
  unexpected: number;
}

export async function rehearseTune(
  steps: TuneSteps,
  gameId: number,
  directory: string,
  expect: readonly string[],
): Promise<TuneRehearsal> {
  await steps.run(["pnpm", "run", "deploy", "dev"]);
  await steps.sleep(Math.max(0, nextDayBoundary(await steps.facts(gameId), steps.now()) - steps.now()));
  const before = await steps.facts(gameId);
  if (pinnedRelease(before) >= NATIVE_RELEASES.frontier.release)
    throw new Error(
      `Game ${gameId} already runs release ${pinnedRelease(before)}; bump the release to rehearse a tune`,
    );
  const appliedAt = steps.now();
  await steps.run(["pnpm", "run", "deploy:cloudflare", "dev", directory]);
  const after = await factsOnRelease(steps, gameId, NATIVE_RELEASES.frontier.release);
  const changes = diffFacts(before, after, ["GameRelease.release_id", ...expect]);
  return {
    gameId,
    releases: [pinnedRelease(before), pinnedRelease(after)],
    appliedAt,
    changes,
    unexpected: changes.filter((change) => !change.expected).length,
  };
}

export function nextDayBoundary(facts: GameFacts, now: number): number {
  const game = onlyRow(facts, "GameRegistry");
  const rules = onlyRow(facts, "SliceRules");
  const day = dayOf(
    {
      seed: BigInt(String(game.seed)),
      startMainAt: Number(game.start_main_at),
      endAt: Number(game.end_at),
      scheduledEndAt: Number(game.scheduled_end_at),
      dayUnitSeconds: Number(rules.day_unit_seconds),
    },
    Math.floor(now / 1000),
  );
  if (!day) throw new Error(`Game ${facts.gameId} is outside its season; a tune reaches a running game`);
  return day.end * 1000;
}

async function factsOnRelease(steps: TuneSteps, gameId: number, releaseId: number): Promise<GameFacts> {
  const deadline = steps.now() + CHECKPOINT_WAIT_MS;
  for (;;) {
    const facts = await steps.facts(gameId);
    if (pinnedRelease(facts) === releaseId) return facts;
    if (steps.now() >= deadline)
      throw new Error(`Herald's checkpoint still pins game ${gameId} to release ${pinnedRelease(facts)}`);
    await steps.sleep(CHECKPOINT_POLL_MS);
  }
}

const pinnedRelease = (facts: GameFacts) => Number(onlyRow(facts, "GameRelease").release_id);

function onlyRow(facts: GameFacts, model: string): Record<string, unknown> {
  const rows = Object.values(facts.models[model] ?? {});
  if (rows.length !== 1) throw new Error(`Game ${facts.gameId} has ${rows.length} ${model} rows`);
  return { ...rows[0]!.key, ...rows[0]!.value };
}

async function runInherited(argv: string[]) {
  const child = Bun.spawn(argv, { stdin: "ignore", stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${argv.join(" ")} exited ${code}`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const expectAt = args.indexOf("--expect");
  const expect = expectAt < 0 ? [] : (args.splice(expectAt, 2)[1] ?? "").split(",").filter(Boolean);
  const [game, directory] = args;
  try {
    if (args.length !== 2 || !directory) throw new Error(USAGE);
    const report = await rehearseTune(
      {
        facts: (gameId) => readGameFacts("dev", gameId),
        run: runInherited,
        sleep: (ms) => Bun.sleep(ms),
        now: () => Date.now(),
      },
      Number(game),
      directory,
      expect,
    );
    console.log(JSON.stringify(report, null, 1));
    if (report.unexpected) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
