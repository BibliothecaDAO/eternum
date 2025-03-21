import { Account } from "starknet";
import { CONFIG, summary, workerStatus } from "./config";
import { getRealmEntityIds } from "./queries";
import { mintLords } from "./system-calls";
import { updateStatusDisplay } from "./utils";

export async function processLordsMinting(
  provider: any,
  adminAccount: { address: string; privateKey: string },
  accountsData: { account: any; realmCount: number; startRealmId: number }[],
) {
  const adminAccountObject = new Account(provider, adminAccount.address, adminAccount.privateKey);
  let totalLordsAttached = 0;

  summary.lordsAttachedByAccount = summary.lordsAttachedByAccount || {};

  for (const data of accountsData) {
    const { account } = data;
    workerStatus[account.address] = {
      ...workerStatus[account.address],
      stage: "waiting_for_lords",
      lastUpdate: new Date(),
    };
  }

  for (let i = 0; i < accountsData.length; i++) {
    const { account } = accountsData[i];
    const accountObject = new Account(provider, account.address, account.privateKey);

    workerStatus[account.address] = {
      stage: "processing_lords",
      completed: 0,
      total: 0,
      lastUpdate: new Date(),
    };

    updateStatusDisplay(accountsData);

    const realmEntityIds = await getRealmEntityIds(accountObject);

    workerStatus[account.address].total = realmEntityIds.length;
    updateStatusDisplay(accountsData);

    let accountLordsAttached = 0;

    for (let j = 0; j < realmEntityIds.length; j++) {
      const realmEntityId = realmEntityIds[j];

      workerStatus[account.address].completed = j + 1;
      workerStatus[account.address].lastUpdate = new Date();
      updateStatusDisplay(accountsData);

      if (CONFIG.mintLords) {
        try {
          await mintLords(adminAccountObject, realmEntityId);

          accountLordsAttached += CONFIG.lordsPerRealm;
          totalLordsAttached += CONFIG.lordsPerRealm;
        } catch (error) {
          summary.errors.push(`Error processing realm ${realmEntityId}: ${error}`);
        }
      }
    }

    workerStatus[account.address] = {
      stage: "lords_completed",
      lastUpdate: new Date(),
    };

    summary.lordsAttachedByAccount[account.address] = accountLordsAttached;
    updateStatusDisplay(accountsData);
  }

  summary.totalLordsAttached = totalLordsAttached;
  return totalLordsAttached;
}
