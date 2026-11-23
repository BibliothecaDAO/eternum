import fs from "node:fs";
import { Contract, hash } from "starknet";
import { loadJsonConfigFile } from "../../../../../scripts-runtime/js/config.js";
import { assertLedgerTreasury, withRaceRewards } from "./race-plan.js";

export function raceSteps({ provider, account, builtClassHash, addressBook, readRelayReceipt, log }) {
  return { declare: declareRewardsClass, deploy: deployRewards, fund: fundRace, status: printRaceStatus };

  async function declareRewardsClass(plan, execute) {
    const classHash = builtClassHash();
    const declared = await isDeclared(classHash);
    if (!execute || declared) return log("race_declare_checked", { classHash, declared, signer: plan.signer });
    await account.declare(plan.signer);
    log("race_declare_complete", { classHash });
  }

  async function deployRewards(plan, execute) {
    assertLedgerTreasury(plan, await provider.getStorageAt(plan.ledger, hash.getSelectorFromName("treasury")));
    if (plan.rewards) {
      await assertRewardsBoundToLedger(plan, plan.rewards);
      return log("race_deploy_checked", { deployed: true, rewards: plan.rewards });
    }
    const classHash = builtClassHash();
    const transaction = { classHash, constructorCalldata: plan.constructorCalldata, signer: plan.signer };
    if (!(await isDeclared(classHash))) throw new Error(`Class ${classHash} is not declared: run declare first`);
    if (!execute) return log("race_deploy_checked", { deployed: false, transaction });
    const rewards = await account.deploy(transaction);
    await assertRewardsBoundToLedger(plan, rewards);
    writeRewardsAddress(rewards);
    log("race_deploy_complete", { rewards, addresses: `contracts/common/addresses/${plan.book}.json` });
  }

  async function fundRace(plan, execute) {
    const race = await readRace(plan);
    if (race.funded) return log("race_fund_checked", { funded: true, race });
    await assertLedgerAdmin(plan);
    await assertLordsBalance(plan);
    if (!execute) return log("race_fund_checked", { funded: false, signer: plan.signer, transaction: plan.calls });
    await account.execute(plan.signer, plan.calls);
    log("race_fund_complete", { race: await readRace(plan) });
  }

  async function printRaceStatus(plan) {
    log("race_status", { race: await readRace(plan), receipt: await readRelayReceipt(plan) });
  }

  async function isDeclared(classHash) {
    try {
      await provider.getClassByHash(classHash);
      return true;
    } catch (error) {
      if (/class hash not found|CLASS_HASH_NOT_FOUND/i.test(String(error?.message))) return false;
      throw error;
    }
  }

  async function assertRewardsBoundToLedger(plan, rewards) {
    for (const [entrypoint, expected] of [
      ["ledger", plan.ledger],
      ["treasury", plan.treasury],
    ]) {
      const [actual] = await provider.callContract({ contractAddress: rewards, entrypoint, calldata: [] }, "latest");
      if (BigInt(actual) !== BigInt(expected))
        throw new Error(`Race rewards ${rewards} answers ${entrypoint} ${actual}, expected ${expected}`);
    }
  }

  async function assertLedgerAdmin(plan) {
    const [held] = await provider.callContract(
      { contractAddress: plan.ledger, entrypoint: "has_role", calldata: ["0x0", plan.signer] },
      "latest",
    );
    if (BigInt(held) !== 1n) throw new Error(`${plan.signer} does not hold DEFAULT_ADMIN_ROLE on ${plan.ledger}`);
  }

  async function assertLordsBalance(plan) {
    const [low, high] = await provider.callContract(
      { contractAddress: plan.lords, entrypoint: "balance_of", calldata: [plan.signer] },
      "latest",
    );
    const [, amountLow, amountHigh] = plan.calls[0].calldata;
    if (BigInt(low) + (BigInt(high) << 128n) < BigInt(amountLow) + (BigInt(amountHigh) << 128n))
      throw new Error(`${plan.signer} holds fewer LORDS than the funding`);
  }

  async function readRace(plan) {
    const { abi } = await provider.getClassAt(plan.rewards);
    const rewards = new Contract({ abi, address: plan.rewards, providerOrAccount: provider });
    return rewards.get_race(plan.shard, plan.game);
  }

  function writeRewardsAddress(rewards) {
    fs.writeFileSync(
      addressBook,
      `${JSON.stringify(withRaceRewards(loadJsonConfigFile(addressBook), rewards), null, 2)}\n`,
    );
  }
}
