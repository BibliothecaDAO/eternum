import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { ec } from "starknet";
import { createCosigner, handleCosignRequest, type CosignerConfig } from "../../../apps/value-relay/src/cosigner";

/** Run only on the independent host; the private key is never an input to Worker deployment. */
function privateFile(path: string) {
  const stat = statSync(path);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error("cosigner_file_requires_0600");
  return readFileSync(path, "utf8").trim();
}
function readConfig(path: string): CosignerConfig & { port: number } {
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
    for (const value of [shard.rpcUrl, shard.heraldUrl]) {
      const url = new URL(value);
      if (
        url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
        throw new Error("cosigner_shard_url_invalid");
    }
  }
  return config;
}
const [command, configPath, keyPath] = process.argv.slice(2);
if (command === "init-key" && configPath && !keyPath) {
  if (!existsSync(configPath)) {
    const key = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
    writeFileSync(configPath, key + "\n", { mode: 0o600, flag: "wx" });
  }
  const key = privateFile(configPath);
  console.log(JSON.stringify({ publicKey: ec.starkCurve.getStarkKey(key) }));
} else if (command === "serve" && configPath && keyPath) {
  const config = readConfig(configPath);
  const signer = createCosigner(config, privateFile(keyPath));
  Bun.serve({
    hostname: "127.0.0.1",
    port: config.port,
    maxRequestBodySize: 4096,
    fetch: (request) => handleCosignRequest(request, config, signer),
  });
  console.log(JSON.stringify({ service: "payout-cosigner", publicKey: signer.publicKey, port: config.port }));
} else throw new Error("usage: main.ts init-key KEY_FILE | serve CONFIG_FILE KEY_FILE");
