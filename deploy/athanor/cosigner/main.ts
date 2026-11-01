import { existsSync, writeFileSync } from "node:fs";
import { ec } from "starknet";
import { COSIGNER_WALLETS, openCosignerWallets } from "./wallets";
import { privateFile, readConfig } from "./config";
import { createCosigner, handleCosignRequest } from "../../../apps/value-relay/src/cosigner";

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
  const signer = createCosigner(config, privateFile(keyPath), openCosignerWallets(COSIGNER_WALLETS));
  Bun.serve({
    hostname: "127.0.0.1",
    port: config.port,
    maxRequestBodySize: 4096,
    fetch: (request) => handleCosignRequest(request, config, signer),
  });
  console.log(JSON.stringify({ service: "payout-cosigner", publicKey: signer.publicKey, port: config.port }));
} else throw new Error("usage: main.ts init-key KEY_FILE | serve CONFIG_FILE KEY_FILE");
