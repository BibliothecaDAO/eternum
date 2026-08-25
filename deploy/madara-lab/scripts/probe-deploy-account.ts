#!/usr/bin/env bun
// Proves that a fresh, unfunded key can deploy its own account on a fee-free chain, and measures how long
// the deployment takes to become pre-confirmed, accepted on L2, and visible through getClassHashAt.
//
//   pnpm lab:probe-account
//
// Prints one JSON line; exit code 1 on any failure. CLI tool: plain HTTP to loopback (see Caddyfile).
import { Account, CallData, ec, hash, logger, RpcProvider, stark } from "starknet";

// starknet.js logs its tip estimator and default paymaster at INFO/ERROR; failures here surface as exceptions.
logger.setLogLevel("FATAL");

const rpcUrl = "http://127.0.0.1:5060/rpc/v0_9_0";
// OpenZeppelin account class the Madara devnet genesis predeploys (class of devnet account #1).
const classHash = "0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6";
const POLL_MS = 50;

async function main() {
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const chainId = await provider.getChainId();
  await provider.getClass(classHash).catch(() => fail(`class ${classHash} is not declared on ${rpcUrl}`));

  const privateKey = stark.randomAddress();
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const constructorCalldata = CallData.compile({ publicKey });
  const address = hash.calculateContractAddressFromHash(publicKey, classHash, constructorCalldata, 0);
  const account = new Account({ provider, address, signer: privateKey });

  const started = performance.now();
  const { transaction_hash } = await account.deployAccount(
    { classHash, constructorCalldata, addressSalt: publicKey },
    { tip: 0 },
  );
  const submitMs = elapsed(started);
  const preConfirmedMs = await waitForStatus(provider, transaction_hash, ["PRE_CONFIRMED", "ACCEPTED_ON_L2"], started);
  const acceptedOnL2Ms = await waitForStatus(provider, transaction_hash, ["ACCEPTED_ON_L2"], started);
  const deployedClass = await provider.getClassHashAt(address);
  const classMatches = BigInt(deployedClass) === BigInt(classHash);

  console.log(
    JSON.stringify({
      rpcUrl,
      chainId,
      classHash,
      address,
      transactionHash: transaction_hash,
      submitMs,
      preConfirmedMs,
      acceptedOnL2Ms,
      classMatches,
    }),
  );
  if (!classMatches) fail(`deployed class ${deployedClass} != ${classHash}`);
}

async function waitForStatus(provider: RpcProvider, txHash: string, wanted: string[], started: number) {
  for (;;) {
    const status = await provider.getTransactionStatus(txHash);
    if (status.finality_status === "REJECTED") fail(`transaction rejected: ${JSON.stringify(status)}`);
    if (status.execution_status === "REVERTED") fail(`transaction reverted: ${JSON.stringify(status)}`);
    if (wanted.includes(status.finality_status)) return elapsed(started);
    await Bun.sleep(POLL_MS);
  }
}

function elapsed(started: number) {
  return Math.round(performance.now() - started);
}

function fail(message: string): never {
  console.error(`probe failed: ${message}`);
  process.exit(1);
}

await main();
