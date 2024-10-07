import { config } from "..";
import devManifest from "../../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../../contracts/manifests/prod/deployment/manifest.json";

import { EternumProvider, FELT_CENTER, ResourcesIds } from "@bibliothecadao/eternum";
import { Account } from "starknet";

if (
  !process.env.VITE_PUBLIC_MASTER_ADDRESS ||
  !process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY ||
  !process.env.VITE_PUBLIC_NODE_URL
) {
  throw new Error("VITE_PUBLIC_MASTER_ADDRESS is required");
}

const VITE_PUBLIC_MASTER_ADDRESS = process.env.VITE_PUBLIC_MASTER_ADDRESS;
const VITE_PUBLIC_MASTER_PRIVATE_KEY = process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;

const manifest = process.env.VITE_PUBLIC_DEV === "true" ? devManifest : productionManifest;
// Bug in bun we have to use http://127.0.0.1:5050/
const nodeUrl = process.env.VITE_PUBLIC_DEV === "true" ? "http://127.0.0.1:5050/" : process.env.VITE_PUBLIC_NODE_URL;

const provider = new EternumProvider(manifest, nodeUrl);
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS, VITE_PUBLIC_MASTER_PRIVATE_KEY);

// entity ids
const ADMIN_BANK_ENTITY_ID = 999999998n;
const LORDS_LIQUIDITY_PER_RESOURCE = 250000;

// Banks
const COORD_X = FELT_CENTER;
const COORD_Y = FELT_CENTER;

export const createAdminBank = async () => {
  const tx = await provider.create_admin_bank({
    signer: account,
    coord: { x: COORD_X, y: COORD_Y },
    owner_fee_num: config.globalConfig.banks.ownerFeesNumerator,
    owner_fee_denom: config.globalConfig.banks.ownerFeesDenominator,
  });
  console.log(`Creating admin bank ${tx.statusReceipt}...`);
};

export const AMMStartingLiquidity: { [key in ResourcesIds]?: number } = {
  [ResourcesIds.Wood]: 10_000_000,
  [ResourcesIds.Stone]: 500_000,
  [ResourcesIds.Coal]: 500_000,
  [ResourcesIds.Copper]: 500_000,
  [ResourcesIds.Obsidian]: 500_000,
  [ResourcesIds.Silver]: 500_000,
  [ResourcesIds.Ironwood]: 400_000,
  [ResourcesIds.ColdIron]: 400_000,
  [ResourcesIds.Gold]: 400_000,
  [ResourcesIds.Hartwood]: 300_000,
  [ResourcesIds.Diamonds]: 200_000,
  [ResourcesIds.Sapphire]: 200_000,
  [ResourcesIds.Ruby]: 200_000,
  [ResourcesIds.DeepCrystal]: 200_000,
  [ResourcesIds.Ignium]: 200_000,
  [ResourcesIds.EtherealSilica]: 200_000,
  [ResourcesIds.TrueIce]: 200_000,
  [ResourcesIds.TwilightQuartz]: 100_000,
  [ResourcesIds.AlchemicalSilver]: 100_000,
  [ResourcesIds.Adamantine]: 100_000,
  [ResourcesIds.Mithral]: 100_000,
  [ResourcesIds.Dragonhide]: 100_000,

  [ResourcesIds.Paladin]: 100_000,
  [ResourcesIds.Crossbowman]: 100_000,
  [ResourcesIds.Knight]: 100_000,
  [ResourcesIds.Donkey]: 100_000,

  [ResourcesIds.Fish]: 10_000_000,
  [ResourcesIds.Wheat]: 10_000_000,
};

const ammResourceIds = Object.keys(AMMStartingLiquidity).map(Number);

export const mintResources = async () => {
  const totalResourceCount = ammResourceIds.length;
  // mint lords
  const lordsTx = await provider.mint_resources({
    signer: account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources: [
      ResourcesIds.Lords,
      config.globalConfig.resources.resourcePrecision * LORDS_LIQUIDITY_PER_RESOURCE * totalResourceCount,
    ],
  });
  console.log(`Minting lords ${lordsTx.statusReceipt}...`);

  // mint all other resources
  const resources = ammResourceIds.flatMap((resourceId) => {
    return [
      resourceId,
      AMMStartingLiquidity[resourceId as keyof typeof AMMStartingLiquidity]! *
        config.globalConfig.resources.resourcePrecision,
    ];
  });

  const resourcesTx = await provider.mint_resources({
    signer: account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources,
  });
  console.log(`Minting resources ${resourcesTx.statusReceipt}...`);
};

export const addLiquidity = async () => {
  for (const [resourceId, amount] of Object.entries(AMMStartingLiquidity)) {
    if (resourceId === ResourcesIds[ResourcesIds.Lords]) {
      continue;
    }

    const tx = await provider.add_liquidity({
      signer: account,
      bank_entity_id: ADMIN_BANK_ENTITY_ID,
      entity_id: ADMIN_BANK_ENTITY_ID,
      resource_type: resourceId,
      resource_amount: amount * config.globalConfig.resources.resourcePrecision,
      lords_amount: LORDS_LIQUIDITY_PER_RESOURCE * config.globalConfig.resources.resourcePrecision,
    });
    console.log(`Adding liquidity for ${resourceId} ${tx.statusReceipt}...`);
  }
};

await createAdminBank();
await mintResources();
await addLiquidity();
