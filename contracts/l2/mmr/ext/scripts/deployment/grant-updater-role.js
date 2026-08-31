import "colors";
import { hash } from "starknet";
import { getContractAddressFromCommonFolder } from "./libs/commands.js";
import { getAccount } from "./libs/network.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

const UPDATER_ROLE = hash.getSelectorFromName("UPDATER_ROLE");

export const grantUpdaterRole = async (updaterAddress) => {
  if (!updaterAddress?.startsWith("0x")) {
    throw new Error("Usage: bun grant-updater-role.js <updater_address>");
  }

  exitIfDeclined(await confirmMainnetDeployment());
  const mmrTokenAddress = await getContractAddressFromCommonFolder("mmrToken");
  if (!mmrTokenAddress) {
    throw new Error("MMR Token address not found. Deploy it first.");
  }

  const account = getAccount();
  const transaction = await account.execute({
    contractAddress: mmrTokenAddress,
    entrypoint: "grant_role",
    calldata: [UPDATER_ROLE, updaterAddress],
  });
  await account.waitForTransaction(transaction.transaction_hash);
  console.log(`Granted MMR UPDATER_ROLE to ${updaterAddress}`.green);
};

grantUpdaterRole(process.argv.at(-1))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
