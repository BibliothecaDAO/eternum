import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as parseNodeArgs } from "node:util";

import {
  DEFAULT_MODEL_PROFILE,
  isModelProfileName,
  MODEL_PROFILE_NAMES,
  type ModelProfileName,
} from "./model-profiles";

/** Only the lab chain runs guest agents today; other chains arrive with the M4 signing lane. */
type RunnerChain = "madara";

export type RunnerGameSelector = { id: number } | { name: string };

export type RunnerSigner =
  | { mode: "none" }
  | { mode: "guest"; bindingAuthorityPrivateKey: string }
  | { mode: "key"; gameplayPrivateKey: string; gameplayAccountAddress: string };

export interface RunnerConfig {
  chain: RunnerChain;
  heraldUrl: string;
  rpcUrl: string;
  game: RunnerGameSelector;
  manifestPath: string;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
  bindingAuthorityAddress: string;
  signer: RunnerSigner;
  /** An explicit --data-dir; otherwise resolveDataDir places it under ./.agent-data/<gameId>. */
  dataDir: string | null;
  modelProfile: ModelProfileName;
  /** The settle username; a signer-derived one is used when absent. */
  username: string | null;
  /** Scripted model and one scripted direction: a full loop pass with no key and no submissions. */
  offline: boolean;
  /** Stop after this many loop ticks; null plays until the game ends. */
  maxTicks: number | null;
  /** How long the slice stream must be quiet before a world-delta wake fires. */
  quietWindowMs: number;
  /** An explicit heartbeat period; null picks the default for the game's mode. */
  heartbeatMs: number | null;
}

type RunnerArgs = Record<string, string | boolean | undefined>;
type Env = Record<string, string | undefined>;

export class RunnerConfigError extends Error {}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DEFAULT_MANIFEST_PATH = "contracts/l3/game/manifest_madara.json";
const DEFAULT_DATA_ROOT = "./.agent-data";
const DEFAULT_QUIET_WINDOW_MS = 5_000;

const FLAGS = {
  chain: { type: "string" },
  "herald-url": { type: "string" },
  "rpc-url": { type: "string" },
  "game-id": { type: "string" },
  "game-name": { type: "string" },
  manifest: { type: "string" },
  "player-account-class-hash": { type: "string" },
  "player-registry-address": { type: "string" },
  "binding-authority-address": { type: "string" },
  signer: { type: "string" },
  "binding-authority-private-key": { type: "string" },
  "gameplay-private-key": { type: "string" },
  "gameplay-account-address": { type: "string" },
  "data-dir": { type: "string" },
  "model-profile": { type: "string" },
  username: { type: "string" },
  offline: { type: "boolean" },
  "max-ticks": { type: "string" },
  "quiet-window-ms": { type: "string" },
  "heartbeat-ms": { type: "string" },
} as const;

export const parseArgs = (argv: readonly string[]): RunnerArgs =>
  parseNodeArgs({ args: [...argv], options: FLAGS, strict: true }).values as RunnerArgs;

/** Flags win over env; every required input that is missing names both spellings instead of defaulting. */
export const resolveConfig = (args: RunnerArgs, env: Env): RunnerConfig => ({
  chain: resolveChain(args),
  heraldUrl: requireValue(args, env, { flag: "herald-url", envVars: ["HERALD_URL", "VITE_PUBLIC_HERALD_URL"] }),
  rpcUrl: requireValue(args, env, { flag: "rpc-url", envVars: ["RPC_URL", "VITE_PUBLIC_NODE_URL"] }),
  game: resolveGameSelector(args),
  manifestPath: path.resolve(
    REPOSITORY_ROOT,
    stringArg(args, "manifest") ?? env.GAME_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH,
  ),
  playerAccountClassHash: requireValue(args, env, {
    flag: "player-account-class-hash",
    envVars: ["VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH"],
  }),
  playerRegistryAddress: requireValue(args, env, {
    flag: "player-registry-address",
    envVars: ["VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS"],
  }),
  bindingAuthorityAddress: requireValue(args, env, {
    flag: "binding-authority-address",
    envVars: ["VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS"],
  }),
  signer: resolveSigner(args, env),
  dataDir: stringArg(args, "data-dir") ?? env.AGENT_DATA_DIR ?? null,
  modelProfile: resolveModelProfile(stringArg(args, "model-profile") ?? env.MODEL_PROFILE),
  username: stringArg(args, "username") ?? env.AGENT_USERNAME ?? null,
  offline: args.offline === true,
  maxTicks: optionalPositiveInteger(args, "max-ticks"),
  quietWindowMs: optionalPositiveInteger(args, "quiet-window-ms") ?? DEFAULT_QUIET_WINDOW_MS,
  heartbeatMs: optionalPositiveInteger(args, "heartbeat-ms"),
});

export const resolveDataDir = (config: RunnerConfig, gameId: number): string =>
  path.resolve(config.dataDir ?? path.join(DEFAULT_DATA_ROOT, String(gameId)));

const stringArg = (args: RunnerArgs, flag: string): string | undefined => {
  const value = args[flag];
  return typeof value === "string" ? value : undefined;
};

const requireValue = (args: RunnerArgs, env: Env, source: { flag: string; envVars: string[] }): string => {
  const value = stringArg(args, source.flag) ?? source.envVars.map((name) => env[name]?.trim()).find(Boolean);
  if (value) return value;
  throw new RunnerConfigError(`Missing --${source.flag} (or ${source.envVars.join(" / ")} in the environment)`);
};

const resolveChain = (args: RunnerArgs): RunnerChain => {
  const chain = stringArg(args, "chain") ?? "madara";
  if (chain !== "madara") throw new RunnerConfigError(`--chain must be madara; received ${chain}`);
  return chain;
};

const resolveGameSelector = (args: RunnerArgs): RunnerGameSelector => {
  const id = stringArg(args, "game-id");
  const name = stringArg(args, "game-name");
  if (id !== undefined && name !== undefined) {
    throw new RunnerConfigError("Pass either --game-id or --game-name, not both");
  }
  if (name !== undefined) return { name };
  if (id === undefined) throw new RunnerConfigError("Missing --game-id or --game-name");
  return { id: requirePositiveInteger("--game-id", id) };
};

const resolveSigner = (args: RunnerArgs, env: Env): RunnerSigner => {
  const mode = stringArg(args, "signer");
  if (mode === undefined) throw new RunnerConfigError("Missing --signer (guest | key | none)");
  switch (mode) {
    case "none":
      return { mode };
    case "guest":
      return {
        mode,
        bindingAuthorityPrivateKey: requireValue(args, env, {
          flag: "binding-authority-private-key",
          envVars: ["BINDING_AUTHORITY_PRIVATE_KEY"],
        }),
      };
    case "key":
      return {
        mode,
        gameplayPrivateKey: requireValue(args, env, {
          flag: "gameplay-private-key",
          envVars: ["GAMEPLAY_PRIVATE_KEY"],
        }),
        gameplayAccountAddress: requireValue(args, env, {
          flag: "gameplay-account-address",
          envVars: ["GAMEPLAY_ACCOUNT_ADDRESS"],
        }),
      };
    default:
      throw new RunnerConfigError(`--signer must be guest, key, or none; received ${mode}`);
  }
};

const resolveModelProfile = (raw: string | undefined): ModelProfileName => {
  if (raw === undefined) return DEFAULT_MODEL_PROFILE;
  if (isModelProfileName(raw)) return raw;
  throw new RunnerConfigError(`--model-profile must be one of ${MODEL_PROFILE_NAMES.join(", ")}; received ${raw}`);
};

const optionalPositiveInteger = (args: RunnerArgs, flag: string): number | null => {
  const raw = stringArg(args, flag);
  return raw === undefined ? null : requirePositiveInteger(`--${flag}`, raw);
};

const requirePositiveInteger = (flag: string, raw: string): number => {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RunnerConfigError(`${flag} must be a positive integer; received ${raw}`);
  }
  return value;
};
