import {
  type Config as EternumConfig
} from "@bibliothecadao/eternum";

import chalk from "chalk";
import fs from "fs";
import { Account } from "starknet";
// import type { Chain } from "@conf";

interface Config {
  account: Account;
  provider: EternumProvider;
  config: EternumConfig;
}

export class GamePopulator {
  public globalConfig: EternumConfig;

  constructor(config: EternumConfig) {
    this.globalConfig = config;
  }

  async populate(account: Account, provider: EternumProvider) {
    const config = { account, provider, config: this.globalConfig };
    await createFakeWorld(config);
  }
}

export const createFakeWorld = async (config: Config) => {
  console.log(
    chalk.cyan(`
   🌎 MAKING FAKE WORLD ⚡
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`),
  );

  let firstRealmId = 1;
  let lastRealmId = 8000;
  let realmId = firstRealmId;
  let startRealmEntityId = 157;
  let batchSize = 1;
  let batch = [];
  for (let side = 0; side < 6; side++) {
    for (let layer = 1; layer < 2; layer++) {
      for (let point = 0; point < layer; point++) {

        if (realmId > lastRealmId) {
          break;
        }
        console.log({realmId})
        batch.push({
          token_id: realmId,
          realms_address: config.config.setup!.addresses.realms,
          season_pass_address: config.config.setup!.addresses.seasonPass,
          realm_settlement: {
            side: side,
            layer: layer,
            point: point,
          },
          realm_entity_id: startRealmEntityId
        });
        if (batch.length === batchSize) {
          try {

            // await config.provider.cheat_test_realms({signer:config.account, calls:batch});
            // await config.provider.cheat_create_villages({signer:config.account, calls:batch});
            // await config.provider.cheat_create_tiles_and_mines({signer:config.account, calls:batch});
            // await config.provider.cheat_create_troops({signer:config.account, calls:batch});
            // await config.provider.cheat_create_realm_buildings({signer:config.account, calls:batch});
            // await config.provider.cheat_create_village_buildings({signer:config.account, calls:batch});
            // await config.provider.cheat_create_village_resource_arrivals({signer:config.account, calls:batch});
            await config.provider.cheat_create_5_trades_per_realm_and_village({signer:config.account, calls:batch});
            batch = [];
          } catch (error) {
            console.error("Error creating realms:", error);
            throw error;
          }
        }

        realmId += 1;
        startRealmEntityId += 3
      }
    }
  }
};



export const nodeReadConfig = async (chain: any) => {
  try {
    let path = "../config/environments/data";
    switch (chain) {
      case "sepolia":
        path += "/sepolia.json"; // as any to avoid type errors
        break;
      case "mainnet":
        path += "/mainnet.json";
        break;
      case "slot":
        path += "/slot.json";
        break;
      case "local":
        path += "/local.json";
        break;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }

    const config = JSON.parse(fs.readFileSync(path, "utf8"));
    return config.configuration as any; // as any to avoid type errors
  } catch (error) {
    throw new Error(`Failed to load configuration for chain ${chain}: ${error}`);
  }
};