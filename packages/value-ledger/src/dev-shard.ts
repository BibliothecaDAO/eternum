/**
 * Whether a shard chain is a dev chain. The shard deploy names every chain at genesis after the environment it deploys,
 * `<ENVIRONMENT>_<time>` (deploy/athanor/scripts/deploy.py `chain_identity`), so dev chains read `DEV_…` and production
 * chains `PRODUCTION_…`. The id belongs to the chain itself: every shard write is signed for it and checked against the
 * RPC's own chain first, so a capability gated here cannot reach a production shard whatever a Worker is configured as.
 */
export const isDevShardChain = (chainId: string): boolean => shortStringOf(chainId)?.startsWith("DEV_") ?? false;

/** A felt read as the ASCII short string the shard deploy encoded; null for a value that is not a felt. */
const shortStringOf = (felt: string): string | null => {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(felt)) return null;
  const hex = BigInt(felt).toString(16);
  const bytes = (hex.length % 2 ? `0${hex}` : hex).match(/../g) ?? [];
  return String.fromCharCode(...bytes.map((byte) => parseInt(byte, 16)));
};
