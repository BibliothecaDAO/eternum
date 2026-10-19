/** The deploy environments whose Workers act on shards, named as the Workers name them (`ENVIRONMENT`). */
export type ShardEnvironment = "staging" | "production";

/**
 * The environment whose shard deploy named this chain. The shard deploy names every chain at genesis after the
 * environment it deploys, `<ENVIRONMENT>_<time>` (deploy/athanor/scripts/deploy.py `chain_identity`), so dev chains read
 * `DEV_…` and production chains `PRODUCTION_…`; null for a chain neither deploy named. The id belongs to the chain
 * itself: every shard write is signed for it and checked against the RPC's own chain first, so a capability gated here
 * cannot reach the other environment's shard whatever a Worker is configured as.
 */
export const shardEnvironmentOf = (chainId: string): ShardEnvironment | null => {
  const name = shortStringOf(chainId);
  if (name?.startsWith("DEV_")) return "staging";
  if (name?.startsWith("PRODUCTION_")) return "production";
  return null;
};

/** Whether a shard chain is a dev chain: only dev shards run what production must never run. */
export const isDevShardChain = (chainId: string): boolean => shardEnvironmentOf(chainId) === "staging";

/**
 * Whether a chain belongs to the other environment. Dev and production share one ledger, whose rows name every shard of
 * both: an environment acts on and audits only its own, and a chain neither deploy named stays its own to fail closed.
 */
export const isOtherEnvironmentChain = (environment: ShardEnvironment, chainId: string): boolean => {
  const owner = shardEnvironmentOf(chainId);
  return owner !== null && owner !== environment;
};

/** A felt read as the ASCII short string the shard deploy encoded; null for a value that is not a felt. */
const shortStringOf = (felt: string): string | null => {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(felt)) return null;
  const hex = BigInt(felt).toString(16);
  const bytes = (hex.length % 2 ? `0${hex}` : hex).match(/../g) ?? [];
  return String.fromCharCode(...bytes.map((byte) => parseInt(byte, 16)));
};
