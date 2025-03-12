import { BuildingType, Direction, multiplyByPrecision, ResourcesIds } from "@bibliothecadao/eternum";
import { CairoOption, CairoOptionVariant, uint256, type Account } from "starknet";
import { summary, SYSTEM_ADDRESSES } from "./config";

export async function createRealm(
  accountObject: Account,
  addresses: any,
  realmSystemsContractAddress: string,
  realmId: number,
) {
  try {
    await accountObject.execute(
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
          calldata: [realmSystemsContractAddress, true],
        },
        {
          contractAddress: realmSystemsContractAddress,
          entrypoint: "create",
          calldata: [accountObject.address, realmId, accountObject.address, 0],
        },
      ],
      { version: 3 },
    );

    return true;
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
  const direction = Direction.EAST;

  try {
    await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.troopManagementSystems,
          entrypoint: "explorer_create",
          calldata: [realmEntityId, 0, 0, multiplyByPrecision(1000), direction],
        },
      ],
      { version: 3 },
    );
  } catch (error) {
    const errorMsg = `Failed to create explorer army for realm ${realmEntityId}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function moveExplorer(account: Account, explorer_id: number) {
  try {
    await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.EAST], 1],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.SOUTH_EAST], 1],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.EAST], 1],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.SOUTH_EAST], 1],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.EAST], 1],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, [Direction.SOUTH_EAST], 1],
        },
      ],
      { version: 3 },
    );
  } catch (error) {
    const errorMsg = `Failed to move explorer ${explorer_id}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}

export async function createBuildings(account: Account, entity_id: number) {
  const produceResourceType = new CairoOption<Number>(CairoOptionVariant.None, 0);

  try {
    await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.EAST], BuildingType.Farm, produceResourceType],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.NORTH_EAST], BuildingType.FishingVillage, produceResourceType],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.NORTH_WEST], BuildingType.Market, produceResourceType],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.WEST], BuildingType.WorkersHut, produceResourceType],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.SOUTH_EAST], BuildingType.Storehouse, produceResourceType],
        },
        {
          contractAddress: SYSTEM_ADDRESSES.productionSystems,
          entrypoint: "create_building",
          calldata: [entity_id, [Direction.SOUTH_WEST], BuildingType.Barracks1, produceResourceType],
        },
      ],
      { version: 3 },
    );
  } catch (error) {
    const errorMsg = `Failed to create building ${entity_id}: ${error}`;
    summary.errors.push(errorMsg);
    throw error;
  }
}
