/**
 * Asks AVNU's live paymaster, through the identity Worker's own paymaster code and with no key, for the gasless builds a
 * Realms wallet's send gets, and checks them by the page's rule. Build only: nothing is signed or sent, and AVNU only
 * simulates. The run exits 1 unless both hold:
 *
 *   1. a send from `<account>` (any deployed SNIP-9 v2 account holding LORDS, a Realms wallet once one is deployed)
 *      builds as the asked call then one LORDS transfer to the execution's caller within the fee answered: callsMatch
 *      with the fee shown, as the page checks before the passkey signs;
 *   2. a fresh Realms wallet holding no LORDS is refused at build (PaymasterRefusedError): its fee cannot be paid.
 *
 *   L2_RPC_URL=<mainnet RPC> bun scripts/default-wallet-gasless-probe.ts <account> [out.json]
 */
import { writeFileSync } from "node:fs";

import { RpcProvider } from "starknet";

import { callsMatch, defaultWalletDeployment, WALLET_GAS_TOKEN, type AskedCall } from "@realms-world/identity/wallet";

import { latestL2GasPrice } from "../server/l2";
import { avnuPaymaster, PaymasterRefusedError, walletExecutionOf } from "../server/paymaster";

const SN_MAIN = "0x534e5f4d41494e";
/** One wei of LORDS to another address: what the Send form prices a send by. */
const PRICED_SEND: AskedCall = {
  contractAddress: WALLET_GAS_TOKEN,
  entrypoint: "transfer",
  calldata: ["0x1", "0x1", "0x0"],
};

const main = async () => {
  const account = process.argv[2];
  const rpc = process.env.L2_RPC_URL;
  if (!account || !rpc)
    throw new Error("usage: L2_RPC_URL=<mainnet RPC> default-wallet-gasless-probe.ts <account> [out.json]");
  const provider = new RpcProvider({ nodeUrl: rpc });
  const paymaster = avnuPaymaster(undefined, () => latestL2GasPrice(provider));
  const checks: Record<string, boolean> = {};
  const check = (name: string, held: boolean) => {
    checks[name] = held;
    console.log(`${held ? "ok  " : "FAIL"} ${name}`);
  };

  const built = await paymaster.build(
    account,
    [{ ...PRICED_SEND, calldata: [...PRICED_SEND.calldata] }],
    null,
    "wallet",
  );
  const execution = walletExecutionOf(built.typedData, SN_MAIN);
  const shown = built.fee && { token: WALLET_GAS_TOKEN, payee: execution?.caller ?? "0x0", max: BigInt(built.fee.max) };
  check(
    "1. a send builds as the asked call, then one LORDS transfer to the paymaster within the fee answered",
    execution !== null && shown !== null && callsMatch(execution.calls, [PRICED_SEND], shown),
  );

  const fresh = defaultWalletDeployment(
    { origin: "https://play.realms.party", rpId: "play.realms.party", publicKeyX: `0x${"11".repeat(32)}` },
    "0x1234567",
    `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")}`,
  );
  const refused = await paymaster
    .build(fresh.address, [{ ...PRICED_SEND, calldata: [...PRICED_SEND.calldata] }], fresh, "wallet")
    .then(
      () => false,
      (error: unknown) => error instanceof PaymasterRefusedError,
    );
  check("2. a fresh Realms wallet with no LORDS is refused at build: its fee cannot be paid", refused);

  const outcome = { at: new Date().toISOString(), account, fee: built.fee, caller: execution?.caller, checks };
  console.log(JSON.stringify(outcome, null, 2));
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(outcome, null, 2));
  if (Object.values(checks).some((held) => !held)) process.exitCode = 1;
};

await main();
