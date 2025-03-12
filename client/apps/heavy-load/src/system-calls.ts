import { multiplyByPrecision } from "@bibliothecadao/eternum";
import { Direction, ResourcesIds } from "@bibliothecadao/eternum";
import { uint256, type Account } from "starknet";
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

export async function mintLords(
  adminAccount: Account,
  devResourceSystemsContractAddress: string,
  realmEntityId: number,
) {
  try {
    await adminAccount.execute(
      [
        {
          contractAddress: devResourceSystemsContractAddress,
          entrypoint: "mint",
          calldata: [realmEntityId, 1, ...[ResourcesIds.Lords, multiplyByPrecision(1000)]],
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

export async function explorerMove(account: Account, explorer_id: number) {
  const directions = [Direction.EAST, Direction.EAST, Direction.EAST, Direction.EAST];

  try {
    await account.execute(
      [
        {
          contractAddress: SYSTEM_ADDRESSES.troopMovementSystems,
          entrypoint: "explorer_move",
          calldata: [explorer_id, directions, 1],
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
