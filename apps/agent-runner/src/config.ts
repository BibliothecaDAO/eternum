import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as parseNodeArgs } from "node:util";

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
  /** Named model profile; unused until the loop lands (M2 part 2). */
  modelProfile: string;
  /** The settle username; a signer-derived one is used when absent. */
  username: string | null;
}

type RunnerArgs = Record<string, string | undefined>;
type Env = Record<string, string | undefined>;

export class RunnerConfigError extends Error {}

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DEFAULT_MANIFEST_PATH = "contracts/l3/game/manifest_madara.json";
const DEFAULT_DATA_ROOT = "./.agent-data";
const DEFAULT_MODEL_PROFILE = "default";

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
} as const;

export const parseArgs = (argv: readonly string[]): RunnerArgs =>
  parseNodeArgs({ args: [...argv], options: FLAGS, strict: true }).values as RunnerArgs;

/** Flags win over env; every required input that is missing names both spellings instead of defaulting. */
export const resolveConfig = (args: RunnerArgs, env: Env): RunnerConfig => ({
  chain: resolveChain(args),
  heraldUrl: requireValue(args, env, { flag: "herald-url", envVars: ["HERALD_URL", "VITE_PUBLIC_HERALD_URL"] }),
  rpcUrl: requireValue(args, env, { flag: "rpc-url", envVars: ["RPC_URL", "VITE_PUBLIC_NODE_URL"] }),
  game: resolveGameSelector(args),
  manifestPath: path.resolve(REPOSITORY_ROOT, args.manifest ?? env.GAME_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH),
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
  dataDir: args["data-dir"] ?? env.AGENT_DATA_DIR ?? null,
  modelProfile: args["model-profile"] ?? env.MODEL_PROFILE ?? DEFAULT_MODEL_PROFILE,
  username: args.username ?? env.AGENT_USERNAME ?? null,
});

export const resolveDataDir = (config: RunnerConfig, gameId: number): string =>
  path.resolve(config.dataDir ?? path.join(DEFAULT_DATA_ROOT, String(gameId)));

const requireValue = (args: RunnerArgs, env: Env, source: { flag: string; envVars: string[] }): string => {
  const value = args[source.flag] ?? source.envVars.map((name) => env[name]?.trim()).find(Boolean);
  if (value) return value;
  throw new RunnerConfigError(`Missing --${source.flag} (or ${source.envVars.join(" / ")} in the environment)`);
};

const resolveChain = (args: RunnerArgs): RunnerChain => {
  const chain = args.chain ?? "madara";
  if (chain !== "madara") throw new RunnerConfigError(`--chain must be madara; received ${chain}`);
  return chain;
};

const resolveGameSelector = (args: RunnerArgs): RunnerGameSelector => {
  if (args["game-id"] !== undefined && args["game-name"] !== undefined) {
    throw new RunnerConfigError("Pass either --game-id or --game-name, not both");
  }
  if (args["game-name"] !== undefined) return { name: args["game-name"] };
  if (args["game-id"] === undefined) throw new RunnerConfigError("Missing --game-id or --game-name");
  return { id: requirePositiveInteger("--game-id", args["game-id"]) };
};

const resolveSigner = (args: RunnerArgs, env: Env): RunnerSigner => {
  const mode = args.signer;
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

const requirePositiveInteger = (flag: string, raw: string): number => {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RunnerConfigError(`${flag} must be a positive integer; received ${raw}`);
  }
  return value;
};
