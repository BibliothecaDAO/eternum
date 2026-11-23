import { PHASE_END_ERROR, type SeasonPhase } from "../../apps/launch-service/src/calendar";
import { seconds } from "./dates";
import { PublicError } from "./errors";
import type { Deployment } from "./main";
import type { Step } from "./run";

export type Season = Omit<Deployment, "revision">;

async function service<T>(context: Season, path: string, method = "GET", body?: unknown): Promise<T> {
  if (!context.apply && method !== "GET") throw new PublicError("Dry run cannot write a service");
  const response = await fetch(`${context.target.origin}${path}`, {
    method,
    redirect: "error",
    headers: {
      "User-Agent": "realms-deployment/1",
      "Content-Type": "application/json",
      ...(context.secrets ? { Authorization: `Bearer ${context.secrets.operator}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const code =
      typeof body?.error === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(body.error)
        ? body.error
        : "invalid_service_error";
    throw new PublicError(`Service ${path}: HTTP ${response.status}; code ${code}.`, response.status, code);
  }
  return response.json() as Promise<T>;
}
async function currentCalendar(context: Season) {
  const calendar = await service<{ phases: SeasonPhase[] }>(context, "/api/factory/calendar");
  const now = Date.now();
  const phases = calendar.phases.filter((phase) => Date.parse(phase.endsAt) > now);
  return phases;
}
export function seasonSteps(context: Season): Step[] {
  const wait = (detail: string) => ({ done: false, waiting: detail, detail });
  return [
    {
      name: "Season calendar",
      payer: "operator token",
      cost: "0 STRK",
      inspect: async () => {
        if (!context.assets) return wait("Deployed services needed");
        const phases = await currentCalendar(context);
        return {
          done: phases.some((phase) => phase.phase === "frontier"),
          detail: phases.length
            ? phases.map((phase) => `${phase.phase} ${phase.startsAt} to ${phase.endsAt}`).join("; ")
            : "set missing phases from saved dates",
        };
      },
      apply: async () => {
        const phases = await currentCalendar(context);
        if (phases.some((existing) => existing.phase === "frontier")) return;
        const begins = seconds(context.inputs!.frontierStart);
        const ends = seconds(context.inputs!.frontierEnd);
        if (!(ends > Date.now() / 1000)) throw new PublicError(PHASE_END_ERROR);
        context.output(
          `Setting frontier calendar: ${new Date(begins * 1000).toISOString()} to ${new Date(ends * 1000).toISOString()}.`,
        );
        await service(context, "/api/factory/calendar/frontier", "PUT", {
          startsAt: new Date(begins * 1000).toISOString(),
          endsAt: new Date(ends * 1000).toISOString(),
        });
      },
    },
  ];
}
