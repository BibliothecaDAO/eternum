import devManifest from "../../contracts/manifests/dev/deployment/manifest.json";
import productionManifest from "../../contracts/manifests/prod/deployment/manifest.json";

import { EternumGlobalConfig, EternumProvider, ResourcesIds } from "@bibliothecadao/eternum";
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
const RESOURCE_LIQUIDITY = 250000;
const LORDS_LIQUIDITY_PER_RESOURCE = 250000;

// Precision
const RESOURCE_PRECISION = 1000;

// Banks
const COORD_X = 2147483899;
const COORD_Y = 2147483801;

const resourceIds = Object.values(ResourcesIds).filter((value) => typeof value === "number");

export const createAdminBank = async () => {
  const tx = await provider.create_admin_bank({
    signer: account,
    coord: { x: COORD_X, y: COORD_Y },
    owner_fee_num: EternumGlobalConfig.banks.ownerFeesNumerator,
    owner_fee_denom: EternumGlobalConfig.banks.ownerFeesDenominator,
  });
  console.log(`Creating admin bank ${tx.statusReceipt}...`);
};

export const mintResources = async () => {
  const totalResourceCount = resourceIds.length - 1;
  // mint lords
  const lordsTx = await provider.mint_resources({
    signer: account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources: [ResourcesIds.Lords, RESOURCE_PRECISION * LORDS_LIQUIDITY_PER_RESOURCE * totalResourceCount],
  });
  console.log(`Minting lords ${lordsTx.statusReceipt}...`);

  // mint all other resources
  const resources = resourceIds.flatMap((resourceId) => {
    if (resourceId === ResourcesIds.Lords) {
      return [];
    }
    return [resourceId, RESOURCE_LIQUIDITY * RESOURCE_PRECISION];
  });

  const resourcesTx = await provider.mint_resources({
    signer: account,
    receiver_id: ADMIN_BANK_ENTITY_ID,
    resources,
  });
  console.log(`Minting resources ${resourcesTx.statusReceipt}...`);
};

export const addLiquidity = async () => {
  for (const resourceId of resourceIds) {
    if (resourceId === ResourcesIds.Lords) {
      continue;
    }
    const tx = await provider.add_liquidity({
      signer: account,
      bank_entity_id: ADMIN_BANK_ENTITY_ID,
      entity_id: ADMIN_BANK_ENTITY_ID,
      resource_type: resourceId,
      resource_amount: RESOURCE_LIQUIDITY * RESOURCE_PRECISION,
      lords_amount: LORDS_LIQUIDITY_PER_RESOURCE * RESOURCE_PRECISION,
    });
    console.log(`Adding liquidity for ${resourceId} ${tx.statusReceipt}...`);
  }
};

await createAdminBank();
await mintResources();
await addLiquidity();
