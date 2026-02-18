/**
 * Example: Using the headless Eternum client.
 *
 * Run with: npx tsx examples/basic-usage.ts
 */
import { EternumClient } from "../src";
import { Account, RpcProvider } from "starknet";

const RPC_URL = "http://localhost:5050";
const TORII_URL = "http://localhost:8080";
const WORLD_ADDRESS = "0x0";
const PRIVATE_KEY = "0x0";
const ACCOUNT_ADDRESS = "0x0";

async function main() {
  // 1. Create the client
  const client = await EternumClient.create({
    rpcUrl: RPC_URL,
    toriiUrl: TORII_URL,
    worldAddress: WORLD_ADDRESS,
    manifest: {
      world: { address: WORLD_ADDRESS },
      contracts: [],
    },
  });

  // 2. Connect a wallet
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
  client.connect(account);

  // 3. Query views — fully hydrated state snapshots
  const realm = await client.view.realm(42);
  console.log("Realm:", realm.entityId);
  console.log("Resources:", realm.resources);
  console.log("Buildings:", realm.buildings);
  console.log("Guard troops:", realm.guard.totalTroops);

  const map = await client.view.mapArea({ x: 100, y: 200, radius: 10 });
  console.log("Structures nearby:", map.structures.length);
  console.log("Armies nearby:", map.armies.length);

  const player = await client.view.player(ACCOUNT_ADDRESS);
  console.log("My structures:", player.structures.length);
  console.log("My armies:", player.armies.length);

  const market = await client.view.market();
  console.log("Recent swaps:", market.recentSwaps.length);

  // 4. Execute transactions
  await client.resources.send(account, {
    senderEntityId: 42,
    recipientEntityId: 99,
    resources: [{ resourceType: 1, amount: 100 }],
  });

  await client.troops.createExplorer(account, {
    forStructureId: 42,
    category: 1,
    tier: 1,
    amount: 10,
    spawnDirection: 0,
  });

  // 5. Cache control — invalidate after mutations
  client.cache.invalidateByPrefix("realm:");
  const freshRealm = await client.view.realm(42);
  console.log("Fresh realm:", freshRealm.entityId);

  client.disconnect();
}

main().catch(console.error);
