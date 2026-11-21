import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CallData } from "starknet";
import { buildRacePlan } from "./race-plan.js";
import { raceSteps } from "./race-steps.js";

const raceAbi = JSON.parse(fs.readFileSync(new URL("../../../schema/race-abi.json", import.meta.url), "utf8"));
const CLASS = "0xc1a55";
const SIGNER = "0x13";
const REWARDS = "0x9";
const book = { ledger: "0x1", lords: "0x2", treasury: "0x3" };
const race = { shard: "0x456", game: "7", amount: "500000" };
const FUNDING = 500000n * 10n ** 18n;

function raceSeason(funded) {
  const outputs = raceAbi
    .flatMap((entry) => (entry.type === "interface" ? entry.items : [entry]))
    .find((entry) => entry.name === "get_race").outputs;
  const zero = { low: 0, high: 0 };
  return new CallData([
    ...raceAbi,
    {
      type: "function",
      name: "answer",
      inputs: [{ name: "race", type: outputs[0].type }],
      outputs: [],
      state_mutability: "view",
    },
  ]).compile("answer", {
    race: {
      funded,
      pool: funded ? { low: FUNDING, high: 0 } : zero,
      posted: false,
      posted_at: 0,
      total: zero,
      paid: zero,
      closed: false,
    },
  });
}

function mainnet(state = {}) {
  const chain = { declared: false, admin: true, lords: FUNDING, funded: false, boundLedger: book.ledger, ...state };
  const sent = [];
  const events = [];
  const addressBook = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "race-steps-")), "dev.json");
  fs.writeFileSync(addressBook, `${JSON.stringify(chain.addresses ?? book, null, 2)}\n`);
  const answers = {
    ledger: () => [chain.boundLedger],
    treasury: () => [book.treasury],
    has_role: () => [chain.admin ? "0x1" : "0x0"],
    balance_of: () => [`0x${chain.lords.toString(16)}`, "0x0"],
    get_race: () => raceSeason(chain.funded),
  };
  const steps = raceSteps({
    provider: {
      getStorageAt: async () => book.treasury,
      getClassByHash: async () => {
        if (!chain.declared) throw new Error("Class hash not found");
      },
      getClassAt: async () => ({ abi: raceAbi }),
      callContract: async ({ entrypoint }) => answers[entrypoint](),
    },
    account: {
      declare: async (signer) => {
        sent.push({ declare: signer });
        chain.declared = true;
      },
      deploy: async (transaction) => {
        sent.push({ deploy: transaction });
        return REWARDS;
      },
      execute: async (signer, calls) => {
        sent.push({ execute: { signer, calls } });
        chain.funded = true;
      },
    },
    builtClassHash: () => CLASS,
    addressBook,
    readRelayReceipt: async () => null,
    log: (event, fields) => events.push({ event, ...fields }),
  });
  const addresses = () => JSON.parse(fs.readFileSync(addressBook, "utf8"));
  const run = (step, execute) =>
    steps[step](
      buildRacePlan({
        step,
        book: "dev",
        addresses: addresses(),
        environment: { STARKNET_ACCOUNT_ADDRESS: SIGNER },
        options: race,
      }),
      execute,
    );
  return { run, sent, events, addresses };
}

test("without --execute every step reports what it would send, sends nothing and writes no address", async () => {
  const fresh = mainnet();
  await fresh.run("declare", false);
  const declared = mainnet({ declared: true });
  await declared.run("deploy", false);
  const deployed = mainnet({ declared: true, addresses: { ...book, raceRewards: REWARDS } });
  await deployed.run("fund", false);
  for (const chain of [fresh, declared, deployed]) assert.deepEqual(chain.sent, []);
  assert.deepEqual(declared.addresses(), book);
  assert.deepEqual(fresh.events, [
    { event: "race_declare_checked", classHash: CLASS, declared: false, signer: SIGNER },
  ]);
  assert.deepEqual(declared.events[0].transaction, {
    classHash: CLASS,
    constructorCalldata: ["0x1", "0x3"],
    signer: SIGNER,
  });
  assert.equal(deployed.events[0].funded, false);
  assert.equal(deployed.events[0].transaction.length, 2);
});

test("declare, deploy and fund send one call each from the signer, and deploy writes the address fund then uses", async () => {
  const chain = mainnet();
  await chain.run("declare", true);
  await chain.run("deploy", true);
  assert.deepEqual(chain.addresses(), { ...book, raceRewards: REWARDS });
  await chain.run("fund", true);
  const wei = [`0x${FUNDING.toString(16)}`, "0x0"];
  assert.deepEqual(chain.sent, [
    { declare: SIGNER },
    { deploy: { classHash: CLASS, constructorCalldata: ["0x1", "0x3"], signer: SIGNER } },
    {
      execute: {
        signer: SIGNER,
        calls: [
          { contractAddress: "0x2", entrypoint: "approve", calldata: [REWARDS, ...wei] },
          { contractAddress: REWARDS, entrypoint: "fund_race", calldata: ["0x456", "7", ...wei] },
        ],
      },
    },
  ]);
  assert.equal(chain.events.at(-1).event, "race_fund_complete");
  assert.equal(chain.events.at(-1).race.funded, true);
});

test("a rerun of each finished step sends nothing more", async () => {
  const chain = mainnet({ declared: true, funded: true, addresses: { ...book, raceRewards: REWARDS } });
  for (const step of ["declare", "deploy", "fund"]) await chain.run(step, true);
  assert.deepEqual(chain.sent, []);
  assert.deepEqual(
    chain.events.map(({ event }) => event),
    ["race_declare_checked", "race_deploy_checked", "race_fund_checked"],
  );
});

test("deploy refuses an undeclared class, and keeps no address of a class bound to another ledger", async () => {
  const undeclared = mainnet();
  await assert.rejects(undeclared.run("deploy", true), /is not declared: run declare first/);
  assert.deepEqual(undeclared.sent, []);
  const foreign = mainnet({ declared: true, boundLedger: "0xbad" });
  await assert.rejects(foreign.run("deploy", true), /answers ledger 0xbad, expected 0x1/);
  assert.deepEqual(foreign.addresses(), book);
});

test("fund sends nothing from a signer without the admin role or without the LORDS", async () => {
  const deployed = { declared: true, addresses: { ...book, raceRewards: REWARDS } };
  const stranger = mainnet({ ...deployed, admin: false });
  await assert.rejects(stranger.run("fund", true), /does not hold DEFAULT_ADMIN_ROLE/);
  const short = mainnet({ ...deployed, lords: FUNDING - 1n });
  await assert.rejects(short.run("fund", true), /holds fewer LORDS than the funding/);
  assert.deepEqual([...stranger.sent, ...short.sent], []);
});
