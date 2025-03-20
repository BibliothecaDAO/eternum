import { BuildingType, Direction, multiplyByPrecision, ResourcesIds } from "@bibliothecadao/eternum";
import { Account, uint256 } from "starknet";
import { provider } from "..";
import { summary, SYSTEM_ADDRESSES } from "./config";

export async function createRealm(
  accountObject: Account,
  addresses: any,
  realmId: number,
  realmSettlement: {
    side: number;
    layer: number;
    point: number;
  },
) {
  try {
    let tx = await accountObject.execute(
      [
        // Mint test realm
        {
          contractAddress: addresses.realms,
          entrypoint: "mint",
          calldata: [uint256.bnToUint256(realmId)],
        },

        // Mint season pass
        {
          contractAddress: addresses.seasonPass,
          entrypoint: "mint",
          calldata: [accountObject.address, uint256.bnToUint256(realmId)],
        },

        // Create realm
        {
          contractAddress: addresses.seasonPass,
          entrypoint: "set_approval_for_all",
          calldata: [SYSTEM_ADDRESSES.realmSystems, true],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.realmSystems,
          entrypoint: "create",
          calldata: [accountObject.address, realmId, accountObject.address, realmSettlement],
        },
      ],
      { version: 3 },
    );

    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    const errorMsg = `Failed to create realm ${realmId}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function mintLords(adminAccount: Account, realmEntityId: number) {
  try {
    await adminAccount.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.devResourceSystems,
          entrypoint: "mint",
          calldata: [realmEntityId, 1, ...[ResourcesIds.Lords, multiplyByPrecision(10000)]],
        },
      ],
      { version: 3 },
    );
  } catch (error) {
    const errorMsg = `Failed to mint lords for realm ${realmEntityId}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function createExplorerArmy(account: Account, realmEntityId: number) {
  const direction: number = Direction.EAST;

  try {
    let tx = await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.troopManagementSystems,
          entrypoint: "explorer_create",
          calldata: [realmEntityId, 0, 0, multiplyByPrecision(1000), direction],
        },
      ],
      { version: 3 },
    );

    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    const errorMsg = `Failed to create explorer army for realm ${realmEntityId}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function moveExplorer(account: Account, explorer_id: number) {
  const numberOfMoves = 20;

  const calls = [];
  for (let i = 0; i < numberOfMoves; i++) {
    const direction = i % 2 === 0 ? Direction.EAST : Direction.SOUTH_EAST;

    calls.push({
      contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
      entrypoint: "explorer_move",
      calldata: [explorer_id, [direction], 1],
    });
  }

  try {
    await account.execute(calls, { version: 3 });
  } catch (error) {
    const errorMsg = `Failed to move explorer ${explorer_id}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function createBuildings(account: Account, entity_id: number) {
  function generateBuildingLayouts() {
    const primaryDirections = [
      Direction.EAST,
      Direction.NORTH_EAST,
      Direction.NORTH_WEST,
      Direction.WEST,
      Direction.SOUTH_WEST,
      Direction.SOUTH_EAST,
    ];

    function generateDirectionArrays() {
      // Layer 1: Single directions - 6 positions
      const layer1: number[][] = primaryDirections.map((direction) => [direction]);

      // Layer 2: Two directions - 12 positions
      const layer2: number[][] = [];

      primaryDirections.forEach((dir, index) => {
        const nextDir = primaryDirections[(index + 1) % primaryDirections.length];

        layer2.push([dir, dir]);
        layer2.push([dir, nextDir]);
      });

      // Layer 3: Three directions - 18 positions
      const layer3: number[][] = [];

      primaryDirections.forEach((dir, index) => {
        const nextDir = primaryDirections[(index + 1) % primaryDirections.length];
        const prevDir = primaryDirections[(index + primaryDirections.length - 1) % primaryDirections.length];

        layer3.push([dir, dir, dir]);
        layer3.push([dir, dir, nextDir]);
        layer3.push([dir, dir, prevDir]);
      });

      // Layer 4: Four directions - 24 positions
      const layer4: number[][] = [];

      primaryDirections.forEach((dir, index) => {
        const nextDir = primaryDirections[(index + 1) % primaryDirections.length];
        const prevDir = primaryDirections[(index + primaryDirections.length - 1) % primaryDirections.length];

        layer4.push([dir, dir, dir, dir]);
        layer4.push([dir, dir, dir, prevDir]);
        layer4.push([dir, dir, dir, nextDir]);
        layer4.push([dir, dir, nextDir, nextDir]);
      });

      return { layer1, layer2, layer3, layer4 };
    }

    // Generate the direction arrays
    return generateDirectionArrays();
  }

  // Generate building layouts
  const buildingLayouts = generateBuildingLayouts();

  try {
    // Create separate calldata arrays for each layer
    const layer1CallData = buildingLayouts.layer1.map((direction) => ({
      contractAddress: SYSTEM_ADDRESSES.productionSystems,
      entrypoint: "create_building",
      calldata: [entity_id, direction, BuildingType.WorkersHut],
    }));

    const layer2CallData = buildingLayouts.layer2.map((directions) => ({
      contractAddress: SYSTEM_ADDRESSES.productionSystems,
      entrypoint: "create_building",
      calldata: [entity_id, directions, BuildingType.WorkersHut],
    }));

    const layer3CallData = buildingLayouts.layer3.map((directions) => ({
      contractAddress: SYSTEM_ADDRESSES.productionSystems,
      entrypoint: "create_building",
      calldata: [entity_id, directions, BuildingType.WorkersHut],
    }));

    const layer4CallData = buildingLayouts.layer4.map((directions) => ({
      contractAddress: SYSTEM_ADDRESSES.productionSystems,
      entrypoint: "create_building",
      calldata: [entity_id, directions, BuildingType.WorkersHut],
    }));

    // Execute a separate transaction for each layer
    // Layer 1
    await account.execute(layer1CallData, { version: 3 });

    // Layer 2
    await account.execute(layer2CallData, { version: 3 });

    // Layer 3
    await account.execute(layer3CallData, { version: 3 });

    // Layer 4
    await account.execute(layer4CallData, { version: 3 });
  } catch (error) {
    const errorMsg = `Failed to create building ${entity_id}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function levelUpRealms(account: Account, entity_id: number) {
  try {
    let tx = await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.structureSystems,
          entrypoint: "level_up",
          calldata: [entity_id],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.structureSystems,
          entrypoint: "level_up",
          calldata: [entity_id],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.structureSystems,
          entrypoint: "level_up",
          calldata: [entity_id],
        },
      ],
      { version: 3 },
    );

    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    const errorMsg = `Failed to level up realm ${entity_id}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function createMarketOrders(
  account: Account,
  maker_id: number,
  maker_gives_resource_type: number,
  taker_pays_resource_type: number,
  maker_gives_max_count: number,
  expires_at: number,
) {
  const taker_id = 0;
  const maker_gives_min_resource_amount = multiplyByPrecision(1);
  const taker_pays_min_resource_amount = maker_gives_max_count / maker_gives_max_count;

  try {
    await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.tradeSystems,
          entrypoint: "create_order",
          calldata: [
            maker_id,
            taker_id,
            maker_gives_resource_type,
            taker_pays_resource_type,
            maker_gives_min_resource_amount,
            maker_gives_max_count,
            taker_pays_min_resource_amount,
            expires_at,
          ],
        },
      ],
      { version: 3 },
    );

  } catch (error) {
    const errorMsg = `Failed to create market order: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}
