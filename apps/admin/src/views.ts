import {
  GAME_ENVIRONMENTS,
  type FactoryRunRecord,
  type PlaytestSlot,
  type SeasonPhase,
} from "@bibliothecadao/launch-service/operator-api";
import {
  isStatusDocument,
  STATE_KEY,
  type MonitorState,
  type Probe,
  type Target as Shard,
} from "@realms-world/status-monitor/model";
import type { Environment, Target } from "./env";
import type { LaunchService } from "./launch";

/** A part of a screen, read on its own: one that fails shows its error and leaves the others standing. */
type Part<T> = { ok: true; value: T } | { ok: false; error: string };

const part = async <T>(read: () => Promise<T>): Promise<Part<T>> => {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/** What status-monitor last wrote for the environment: its probes and the shards it watches. */
const monitorState = async (target: Target): Promise<MonitorState> => {
  const object = await target.status.get(STATE_KEY);
  if (!object) throw new Error("status-monitor has written no state");
  const state = (await object.json()) as MonitorState;
  if (!isStatusDocument(state.document)) throw new Error("status-monitor state is malformed");
  return state;
};

/** The Games screen: the environment's health, its calendar, its Blitz slots and every run. */
interface GamesView {
  environment: Environment;
  origin: string;
  status: Part<{ checkedAt: number; components: Omit<Probe, "paused">[] }>;
  calendar: Part<SeasonPhase[]>;
  slots: Part<PlaytestSlot[]>;
  runs: Part<FactoryRunRecord[]>;
}

export const gamesView = async (target: Target, launch: LaunchService): Promise<GamesView> => {
  const [status, calendar, slots, runs] = await Promise.all([
    part(async () => {
      const { document } = await monitorState(target);
      return {
        checkedAt: document.checked_at,
        components: document.components.map(({ id, name, status, latency_ms }) => ({ id, name, status, latency_ms })),
      };
    }),
    part(async () => (await launch.read<{ phases: SeasonPhase[] }>("/api/factory/calendar")).phases),
    part(async () => (await launch.read<{ slots: PlaytestSlot[] }>("/api/slots")).slots),
    part(async () => {
      const lists = await Promise.all(
        GAME_ENVIRONMENTS.map((environment) =>
          launch.read<{ runs: FactoryRunRecord[] }>(`/api/factory/runs?environment=${environment}`),
        ),
      );
      return lists.flatMap(({ runs }) => runs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
  ]);
  return { environment: target.environment, origin: target.origin, status, calendar, slots, runs };
};

const RELEASE_LINE = /^self\.REALMS_RELEASE = "([^"]*)";/;

/** The client's release, which the build stamps on the first line of its service worker. */
const clientRelease = async (target: Target, send: typeof fetch): Promise<string> => {
  const response = await send(`${target.origin}/sw.js`, { redirect: "manual" });
  if (!response.ok) throw new Error(`/sw.js answered ${response.status}`);
  const release = RELEASE_LINE.exec(await response.text())?.[1];
  if (!release) throw new Error("the client's service worker names no release");
  return release;
};

/** The commands that deploy an environment, run by the owner from a checkout of the pushed commit. */
const deployCommands = (environment: Environment) => ({
  box: `pnpm run deploy ${environment}`,
  cloudflare: `pnpm run deploy:cloudflare ${environment} "$HOME/.realms-${environment}"`,
});

/** The Deploys screen: what runs in the environment now, and how to deploy it. Nothing here deploys. */
interface DeploysView {
  environment: Environment;
  workers: Part<{ version: string; revision: string }>;
  client: Part<string>;
  shards: Part<Shard[]>;
  commands: ReturnType<typeof deployCommands>;
}

export const deploysView = async (target: Target, launch: LaunchService, send: typeof fetch): Promise<DeploysView> => {
  const [workers, client, shards] = await Promise.all([
    part(async () => {
      const { version, revision } = await launch.read<{ version: string; revision: string }>("/api/factory/version");
      return { version, revision };
    }),
    part(() => clientRelease(target, send)),
    part(async () => (await monitorState(target)).targets),
  ]);
  return { environment: target.environment, workers, client, shards, commands: deployCommands(target.environment) };
};
