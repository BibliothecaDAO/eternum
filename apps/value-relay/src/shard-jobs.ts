import { serviceFailure } from "@realms-world/value-ledger";
import { relayServiceErrors } from "./ports";

export interface GameFailure {
  game: number;
  error: unknown;
}

export interface JobFailure {
  job: string;
  game: number | null;
  code: string;
  cause: string;
}

type ShardJob = () => Promise<readonly GameFailure[]>;

export async function forEachGame<Game extends { game_id: number }>(
  games: readonly Game[],
  run: (game: Game) => Promise<void>,
): Promise<GameFailure[]> {
  const failures: GameFailure[] = [];
  for (const game of games) {
    try {
      await run(game);
    } catch (error) {
      failures.push({ game: game.game_id, error });
    }
  }
  return failures;
}

export async function runShardJobs(jobs: Record<string, ShardJob>, secrets: readonly string[]): Promise<JobFailure[]> {
  const failures: JobFailure[] = [];
  for (const [job, run] of Object.entries(jobs)) {
    for (const failure of await gameFailuresOf(run)) failures.push(jobFailure(job, failure, secrets));
  }
  return failures;
}

async function gameFailuresOf(run: ShardJob): Promise<readonly { game: number | null; error: unknown }[]> {
  try {
    return await run();
  } catch (error) {
    return [{ game: null, error }];
  }
}

function jobFailure(job: string, failure: { game: number | null; error: unknown }, secrets: readonly string[]) {
  const { code, message } = serviceFailure(failure.error, relayServiceErrors, job, secrets);
  const reported = { job, game: failure.game, code, cause: message };
  console.error("shard_job_failed", reported);
  return reported;
}
