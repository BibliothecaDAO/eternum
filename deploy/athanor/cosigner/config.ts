import { readFileSync, statSync } from "node:fs";
import type { CosignerConfig } from "../../../apps/value-relay/src/cosigner";

/** Run only on the independent host; the private key is never an input to Worker deployment. */
export function privateFile(path: string) {
  const stat = statSync(path);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error("cosigner_file_requires_0600");
  return readFileSync(path, "utf8").trim();
}

export function readConfig(path: string): CosignerConfig & { port: number } {
  const config = JSON.parse(privateFile(path)) as CosignerConfig & { port: number };
  for (const name of ["l2RpcUrl", "identityUrl"] as const)
    if (new URL(config[name]).protocol !== "https:") throw new Error("cosigner_https_required");
  if (
    !config.identityToken ||
    !config.requestToken ||
    !Number.isInteger(config.port) ||
    config.port < 1024 ||
    config.port > 65535
  )
    throw new Error("cosigner_configuration_invalid");
  if (BigInt(config.l2ChainId) <= 0n || BigInt(config.ledgerAddress) <= 0n || !config.shards?.length)
    throw new Error("cosigner_identity_missing");
  const seen = new Set<string>();
  for (const shard of config.shards) {
    const chain = BigInt(shard.chainId).toString();
    if (
      seen.has(chain) ||
      BigInt(shard.gamesAddress) <= 0n ||
      !Number.isSafeInteger(shard.firstRelease) ||
      shard.firstRelease < 1
    )
      throw new Error("cosigner_shard_invalid");
    seen.add(chain);
  }
  return config;
}
