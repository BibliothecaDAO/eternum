import { randomUUID } from "node:crypto";
import type {
  LaunchGameSummary,
  LaunchRotationSummary,
  LaunchSeriesSummary,
} from "../../../config/deployer/clean/types";
import { launchName, type ClaimedLaunchRun, type LaunchRun, type LaunchSummary } from "./model";
import { applyDurableLaunchDefaults, type LaunchJobRequest, type LaunchKind } from "./schemas";
import type { LaunchServiceStore } from "./store";

export class InMemoryLaunchStore implements LaunchServiceStore {
  readonly runs = new Map<string, LaunchRun>();

  async initialize(): Promise<void> {}
  async close(): Promise<void> {}

  async enqueue(kind: LaunchKind, request: LaunchJobRequest): Promise<LaunchRun> {
    const durableRequest = applyDurableLaunchDefaults(kind, request);
    const name = launchName(kind, durableRequest);
    const key = this.key(kind, durableRequest.environment, name);
    const existing = this.runs.get(key);
    if (existing?.status === "running") throw new Error(`${kind} launch "${name}" is already running`);
    const now = new Date().toISOString();
    const run: LaunchRun = {
      id: randomUUID(),
      kind,
      environment: durableRequest.environment,
      name,
      request: durableRequest,
      status: "queued",
      attempts: 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      summary: existing?.summary,
    };
    this.runs.set(key, run);
    return run;
  }

  async list(environment: "madara.blitz", kind?: LaunchKind): Promise<LaunchRun[]> {
    return Array.from(this.runs.values()).filter(
      (run) => run.environment === environment && (kind === undefined || run.kind === kind),
    );
  }

  async find(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<LaunchRun | null> {
    return this.runs.get(this.key(kind, environment, name)) ?? null;
  }

  async claim(leaseMs: number): Promise<ClaimedLaunchRun | null> {
    const now = Date.now();
    for (const [key, run] of this.runs) {
      if (run.status === "running" && Date.parse(run.claimedUntil ?? "") <= now) {
        this.runs.set(key, { ...run, status: "queued", claimedUntil: undefined, leaseToken: undefined });
      }
    }
    if (Array.from(this.runs.values()).some((run) => run.status === "running")) return null;
    const entry = Array.from(this.runs.entries()).find(([, run]) => run.status === "queued");
    if (!entry) return null;
    const [key, run] = entry;
    const claimed: ClaimedLaunchRun = {
      ...run,
      status: "running",
      attempts: run.attempts + 1,
      updatedAt: new Date().toISOString(),
      claimedUntil: new Date(now + leaseMs).toISOString(),
      leaseToken: randomUUID(),
    };
    this.runs.set(key, claimed);
    return claimed;
  }

  async heartbeat(runId: string, leaseToken: string, leaseMs: number): Promise<boolean> {
    const entry = this.findById(runId);
    if (!entry || entry[1].leaseToken !== leaseToken || entry[1].status !== "running") return false;
    this.runs.set(entry[0], { ...entry[1], claimedUntil: new Date(Date.now() + leaseMs).toISOString() });
    return true;
  }

  async complete(runId: string, leaseToken: string, summary: LaunchSummary): Promise<LaunchRun> {
    const entry = this.requireLease(runId, leaseToken);
    const completed: LaunchRun = {
      ...entry[1],
      status: "complete",
      summary,
      claimedUntil: undefined,
      leaseToken: undefined,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    this.runs.set(entry[0], completed);
    return completed;
  }

  async retry(runId: string, leaseToken: string, errorMessage: string): Promise<void> {
    const entry = this.requireLease(runId, leaseToken);
    this.runs.set(entry[0], {
      ...entry[1],
      status: "queued",
      errorMessage,
      claimedUntil: undefined,
      leaseToken: undefined,
    });
  }

  async fail(runId: string, leaseToken: string, errorMessage: string): Promise<void> {
    const entry = this.requireLease(runId, leaseToken);
    this.runs.set(entry[0], {
      ...entry[1],
      status: "failed",
      errorMessage,
      claimedUntil: undefined,
      leaseToken: undefined,
    });
  }

  async cancel(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean> {
    const key = this.key(kind, environment, name);
    const run = this.runs.get(key);
    if (!run || run.status === "running") return false;
    this.runs.set(key, { ...run, status: "cancelled" });
    return true;
  }

  async delete(kind: LaunchKind, environment: "madara.blitz", name: string): Promise<boolean> {
    const key = this.key(kind, environment, name);
    const run = this.runs.get(key);
    return !run || run.status === "running" ? false : this.runs.delete(key);
  }

  async loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null> {
    const summary = (await this.find("game", environment as "madara.blitz", gameName))?.summary;
    return summary && "gameName" in summary ? summary : null;
  }

  async saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary> {
    const environment = summary.environment as "madara.blitz";
    if (this.runs.has(this.key("game", environment, summary.gameName))) {
      await this.attachSummary("game", environment, summary.gameName, summary);
      return summary;
    }
    const parent = this.findParentRun(environment, summary.gameName);
    if (!parent) throw new Error(`No run owns ${summary.gameName}`);
    return { ...summary, outputPath: `memory://launch_runs/${parent.id}/summary` };
  }

  async loadSeries(
    environment: LaunchSeriesSummary["environment"],
    seriesName: string,
  ): Promise<LaunchSeriesSummary | null> {
    const summary = (await this.find("series", environment as "madara.blitz", seriesName))?.summary;
    return summary && "seriesName" in summary && !("rotationName" in summary) ? summary : null;
  }

  async saveSeries(summary: LaunchSeriesSummary): Promise<LaunchSeriesSummary> {
    await this.attachSummary("series", summary.environment as "madara.blitz", summary.seriesName, summary);
    return summary;
  }

  async loadRotation(
    environment: LaunchRotationSummary["environment"],
    rotationName: string,
  ): Promise<LaunchRotationSummary | null> {
    const summary = (await this.find("rotation", environment as "madara.blitz", rotationName))?.summary;
    return summary && "rotationName" in summary ? summary : null;
  }

  async saveRotation(summary: LaunchRotationSummary): Promise<LaunchRotationSummary> {
    await this.attachSummary("rotation", summary.environment as "madara.blitz", summary.rotationName, summary);
    return summary;
  }

  private async attachSummary(
    kind: LaunchKind,
    environment: "madara.blitz",
    name: string,
    summary: LaunchSummary,
  ): Promise<void> {
    const key = this.key(kind, environment, name);
    const run = this.runs.get(key);
    if (!run) throw new Error(`No run owns ${name}`);
    this.runs.set(key, { ...run, summary });
  }

  private findParentRun(environment: "madara.blitz", gameName: string): LaunchRun | undefined {
    return Array.from(this.runs.values()).find(
      (run) =>
        run.environment === environment &&
        run.kind !== "game" &&
        run.summary !== undefined &&
        "games" in run.summary &&
        run.summary.games.some((game) => game.gameName === gameName),
    );
  }

  private key(kind: LaunchKind, environment: string, name: string): string {
    return `${kind}:${environment}:${name}`;
  }

  private findById(runId: string): [string, LaunchRun] | undefined {
    return Array.from(this.runs.entries()).find(([, run]) => run.id === runId);
  }

  private requireLease(runId: string, leaseToken: string): [string, LaunchRun] {
    const entry = this.findById(runId);
    if (!entry || entry[1].leaseToken !== leaseToken || entry[1].status !== "running") {
      throw new Error(`Launch lease for ${runId} is not active`);
    }
    return entry;
  }
}
