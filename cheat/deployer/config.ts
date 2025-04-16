import {
  type Config as EternumConfig
} from "@bibliothecadao/eternum";

import chalk from "chalk";
import fs from "fs";
import { Account } from "starknet";
// import type { Chain } from "@conf";

interface Config {
  accounts: Account[];
  provider: EternumProvider;
  config: EternumConfig;
}

export class GamePopulator {
  public globalConfig: EternumConfig;

  constructor(config: EternumConfig) {
    this.globalConfig = config;
  }

  async populate(accounts: Account[], provider: EternumProvider) {
    const config = { accounts, provider, config: this.globalConfig };
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
  let lastRealmId = 7998;
  let realmId = firstRealmId;
  let startRealmEntityId = 157;
  let batch = [];
  let batchSize = 2;
  let signersStartIndex = 0;
  let signersEndIndex = batchSize * 7;
  for (let side = 0; side < 6; side++) {
    for (let layer = 1; layer < 53; layer++) {
      for (let point = 0; point < layer; point++) {
        //
        //
        //
        if (realmId <= 2070) {
          realmId += 1;
          startRealmEntityId += 3
          continue;
        }
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
        if (batch.length === batchSize || realmId === lastRealmId) {
          try {

            // set batch size = 12, signers length = 12
            // await config.provider.cheat_test_realms({signers:config.accounts, calls:batch});

            // set batch size = 2, signers length = 12
            let actualSigners = config.accounts.slice(signersStartIndex, signersEndIndex);
            // await config.provider.cheat_create_villages({signers: actualSigners, calls:batch});
            // await config.provider.cheat_create_tiles_and_mines({signers: actualSigners, calls:batch});
            // await config.provider.cheat_create_troops({signers: actualSigners, calls:batch});
            await config.provider.cheat_create_realm_and_village_buildings({signers: actualSigners, calls:batch});
            // await config.provider.cheat_create_village_resource_arrivals({signer:config.account, calls:batch});
            // await config.provider.cheat_create_5_trades_per_realm_and_village({signer:config.account, calls:batch});
            batch = [];
            signersStartIndex += batchSize * 7;
            signersEndIndex += batchSize * 7;
            if (signersEndIndex >= config.accounts.length) {
              signersStartIndex = 0;
              signersEndIndex = batchSize * 7;
            }
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