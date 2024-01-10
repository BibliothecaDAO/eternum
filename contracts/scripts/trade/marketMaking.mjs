import { EternumProvider } from "@bibliothecadao/eternum";
import dev_manifest from "../../target/dev/manifest.json" with {type: "json"};
import prod_manifest from "../../target/release/manifest.json" with {type: "json"};
import {Account, RpcProvider} from 'starknet'
import {RESOURCE_WEIGHTS} from '../config/constants.js'

// determine the wood price of lords, then create buy/sell orders for that price
// use the weight of other resources

const MINT_NEW_REALM = true;
const MINT_ALL_RESOURCES = true;
const CREATE_ORDERS = true;
const REALM_ENTITY_ID = undefined;
const CURRENT_BLOCKTIME = 1705640737;
// one month
const VALIDITY_TIME = 604800;
const BASE_WOOD_AMOUNT = 252
const BASE_LORDS_PER_WOOD = 3;
const PRECISION = 1000;

// get the uuid
const eternumProvider = new EternumProvider(
  process.env.SOZO_WORLD,
  process.env.STARKNET_RPC_URL,
  dev_manifest
);

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL
});


const account = new Account(provider, process.env.DOJO_ACCOUNT_ADDRESS, process.env.DOJO_PRIVATE_KEY);

const mintNewRealm = async () => {
  await eternumProvider.create_realm({realm_id: 8001,
    resource_types_packed: 0,
    resource_types_count: 0,
    cities: 255,
    harbors: 0,
    rivers: 0,
    regions: 0,
    wonder: 0,
    order: 17,
    order_hyperstructure_id: 0, 
    position: {
        x: 1814620,
        y: 1799232,
    }, signer: account})
  await new Promise((resolve) => setTimeout(resolve, 2000));
};

const mintAllResources = async (entityId) => {
    let resources = Array.from({length: 21}, (_, i) => i + 1);
    resources.push(253);
    resources.push(254);
    resources.push(255);

    await eternumProvider.mint_resources({
      receiver_id: entityId,
      resources: resources.flatMap((resourceId) => [resourceId, 1000000000000n]),
      signer: account,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
};

const createOrders  = async () => {
  let uuid = await eternumProvider.uuid();
  if (MINT_NEW_REALM) await mintNewRealm();
  let maker_id = MINT_NEW_REALM? uuid: REALM_ENTITY_ID;
  if (MINT_ALL_RESOURCES) await mintAllResources(maker_id);

  if (!CREATE_ORDERS) return;
  const orders = RESOURCE_WEIGHTS.flatMap((resource, i) => {
    const weight = Number(resource[1]) / Number(RESOURCE_WEIGHTS[0][1]);
    const resourceAmount = BASE_WOOD_AMOUNT * weight * PRECISION;
    const lordsAmount = BASE_WOOD_AMOUNT * BASE_LORDS_PER_WOOD * PRECISION;
    let resourceOrders = [];
    for (let j = 0; j < 10; j++) {
      let multiplier = 1 + 0.1 * j;
      const order = {
        // resource id
        resourceId: i + 1,
        resourceAmount: Math.round(resourceAmount),
        lordsAmounts: [Math.round(lordsAmount * multiplier), Math.round(lordsAmount / multiplier)],
      }
      resourceOrders.push(order)
    }
    return resourceOrders;
  })


  for (const order of orders) {
    console.log({order})
    await eternumProvider.create_order({
      maker_id, 
      maker_gives_resource_types: [order.resourceId],
      maker_gives_resource_amounts: [order.resourceAmount],
      taker_id: 0,
      taker_gives_resource_types: [253],
      taker_gives_resource_amounts: [order.lordsAmounts[0]],
      signer: account,
      donkeys_quantity: 1,
      expires_at: (CURRENT_BLOCKTIME || Date.now()) + VALIDITY_TIME,
    });
    // wait 2 seconds between orders
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await eternumProvider.create_order({
      maker_id, 
      maker_gives_resource_types: [253],
      maker_gives_resource_amounts: [order.lordsAmounts[1]],
      taker_id: 0,
      taker_gives_resource_types: [order.resourceId],
      taker_gives_resource_amounts: [order.resourceAmount],
      signer: account,
      donkeys_quantity: Math.ceil(order.resourceAmount / (1000 * 100)),
      expires_at: (CURRENT_BLOCKTIME || Date.now()) + VALIDITY_TIME,
  })
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};

createOrders();


