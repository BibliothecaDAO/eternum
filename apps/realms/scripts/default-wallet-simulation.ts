/**
 * Proves a default wallet against the chain's own Ready 0.5 class, spending nothing: one simulated transaction deploys
 * a fresh wallet at its counterfactual address through the Universal Deployer (as the paymaster deploys it), then runs
 * an outside execution signed by a passkey and co-signed by our guardian code, as the paymaster runs it. The simulation
 * skips the relayer's own validation and the fee charge; the wallet's signature check runs inside the execution, so it
 * is not skipped. A forged owner signature and a missing guardian signature must each be refused, or the success proves
 * nothing. Exits 1 unless all three relays end as they must.
 *
 *   L2_RPC_URL=<mainnet RPC> bun scripts/default-wallet-simulation.ts [out.json]
 *     A passkey made here, signing exactly as an authenticator does.
 *   L2_RPC_URL=… bun scripts/default-wallet-simulation.ts plan <passkey.json> <plan.json>
 *   L2_RPC_URL=… bun scripts/default-wallet-simulation.ts prove <plan.json> <owner-signature.json> [out.json]
 *     A browser's passkey: passkey.json is {origin, rpId, publicKey} (its SubjectPublicKeyInfo, base64url, as the game's
 *     createPasskey returns it); plan.json then holds the hash to sign; owner-signature.json is the game's
 *     signWithPasskey answer for that hash.
 *
 * The guardian is a throwaway key; no key or plan here touches the chain beyond the simulation.
 */
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { CallData, ec, hash, outsideExecution, RpcProvider, typedData, type Call } from "starknet";

import { createGuardian } from "@realms-world/guardian";
import {
  defaultWalletDeployment,
  defaultWalletSignature,
  passkeyChallenge,
  passkeyOwnerSignature,
  passkeyPublicKeyX,
  type PasskeyOwner,
} from "@realms-world/identity/wallet";

/** The Universal Deployer: `deployContract(class, salt, unique = false, calldata)` deploys from address zero. */
const UDC = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";
const LORDS = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

/** Everything a relay needs but the owner's signature: the wallet, the execution it signs, and the guardian. */
interface Plan {
  chainId: string;
  owner: PasskeyOwner;
  realmsId: string;
  guardianKey: string;
  execution: { caller: string; nonce: string; execute_after: number; execute_before: number };
  calls: Call[];
  wallet: string;
  executionHash: string;
}

const main = async () => {
  const provider = new RpcProvider({ nodeUrl: requiredEnv("L2_RPC_URL") });
  const [command, ...files] = process.argv.slice(2);
  if (command === "plan") {
    const passkey = JSON.parse(readFileSync(files[0]!, "utf8")) as { origin: string; rpId: string; publicKey: string };
    const owner = {
      origin: passkey.origin,
      rpId: passkey.rpId,
      publicKeyX: passkeyPublicKeyX(Buffer.from(passkey.publicKey, "base64url")),
    };
    const plan = await planFor(provider, owner);
    writeFileSync(files[1]!, JSON.stringify(plan, null, 2));
    console.log(JSON.stringify({ wallet: plan.wallet, executionHash: plan.executionHash }));
    return;
  }
  if (command === "prove") {
    const plan = JSON.parse(readFileSync(files[0]!, "utf8")) as Plan;
    const ownerSignature = JSON.parse(readFileSync(files[1]!, "utf8")) as string[];
    return report(await prove(provider, plan, ownerSignature), files[2]);
  }
  const passkey = createPasskey();
  const plan = await planFor(provider, passkey.owner);
  const ownerSignature = passkeyOwnerSignature(passkey.owner, plan.executionHash, passkey.sign(plan.executionHash));
  return report(await prove(provider, plan, ownerSignature), command);
};

/** A fresh wallet for this passkey under a throwaway guardian, and a LORDS approve of zero for it to sign. */
const planFor = async (provider: RpcProvider, owner: PasskeyOwner): Promise<Plan> => {
  const chainId = await provider.getChainId();
  const guardianKey = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
  const realmsId = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
  const wallet = defaultWalletDeployment(owner, ec.starkCurve.getStarkKey(guardianKey), realmsId).address;
  const calls: Call[] = [{ contractAddress: LORDS, entrypoint: "approve", calldata: [UDC, "0", "0"] }];
  const execution = {
    caller: "0x414e595f43414c4c4552", // ANY_CALLER
    nonce: `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")}`,
    execute_after: 1,
    execute_before: Math.floor(Date.now() / 1000) + 3600,
  };
  const message = outsideExecution.getTypedData(chainId, execution, execution.nonce, calls, "2");
  return {
    chainId,
    owner,
    realmsId,
    guardianKey,
    execution,
    calls,
    wallet,
    executionHash: typedData.getMessageHash(message, wallet),
  };
};

/** The three relays: signed, owner forged, guardian missing; with the deploy's own cost for comparison. */
const prove = async (provider: RpcProvider, plan: Plan, ownerSignature: string[]) => {
  const guardianKey = plan.guardianKey;
  const guardianPublicKey = ec.starkCurve.getStarkKey(guardianKey);
  const deployment = defaultWalletDeployment(plan.owner, guardianPublicKey, plan.realmsId);
  const outsideCalls = plan.calls.map(outsideExecution.getOutsideCall);
  // Our guardian's own code co-signs: it rebuilds the message from the execution's fields.
  const guardian = await createGuardian(guardianKey).signWalletExecution(plan.chainId, deployment.address, {
    caller: plan.execution.caller,
    nonce: plan.execution.nonce,
    executeAfter: String(plan.execution.execute_after),
    executeBefore: String(plan.execution.execute_before),
    calls: outsideCalls.map((call) => ({
      to: call.to,
      selector: String(call.selector),
      calldata: CallData.toHex(call.calldata),
    })),
  });
  const signature = defaultWalletSignature(ownerSignature, { publicKey: guardianPublicKey, ...guardian });

  const relayer = await anyMainnetAccount(provider);
  const relayerNonce = await provider.getNonceForAddress(relayer);
  const relay = (walletSignature: string[] | null) =>
    simulate(requiredEnv("L2_RPC_URL"), relayerNonce, relayer, [
      {
        contractAddress: UDC,
        entrypoint: "deployContract",
        calldata: [
          deployment.class_hash,
          deployment.salt,
          "0",
          String(deployment.calldata.length),
          ...deployment.calldata,
        ],
      },
      ...(walletSignature === null
        ? []
        : [
            {
              contractAddress: deployment.address,
              entrypoint: "execute_from_outside_v2",
              calldata: outsideExecution.buildExecuteFromOutsideCallData({
                outsideExecution: { ...plan.execution, calls: outsideCalls },
                signature: walletSignature,
                signerAddress: deployment.address,
                version: "2",
              }),
            },
          ]),
    ]);
  const forgedOwner = [...signature];
  forgedOwner[forgedOwner.length - 6] = `0x${(BigInt(forgedOwner[forgedOwner.length - 6]!) ^ 1n).toString(16)}`;
  const signed = await relay(signature);
  const deployOnly = await relay(null);
  return {
    chainId: plan.chainId,
    origin: plan.owner.origin,
    wallet: deployment.address,
    executionHash: plan.executionHash,
    signatureFelts: signature.length,
    runs: {
      signed: revertOf(signed),
      forgedOwner: revertOf(await relay(forgedOwner)),
      withoutGuardian: revertOf(await relay(["0x1", ...ownerSignature])),
    },
    /** What the relay costs in STRK at this block's prices: deploy and the first call, and the deploy alone. */
    strk: { deployAndCall: strkOf(signed), deployOnly: strkOf(deployOnly) },
    signedFee: signed.fee_estimation ?? null,
  };
};

const report = (outcome: Awaited<ReturnType<typeof prove>>, out: string | undefined) => {
  console.log(JSON.stringify(outcome, null, 2));
  if (out) writeFileSync(out, JSON.stringify(outcome, null, 2));
  const proven =
    outcome.runs.signed === null &&
    outcome.runs.forgedOwner?.includes("argent/invalid-owner-sig") &&
    outcome.runs.withoutGuardian?.includes("argent/missing-guardian-sig");
  if (!proven) process.exit(1);
};

const strkOf = (result: Record<string, unknown>): number =>
  Number(BigInt((result.fee_estimation as { overall_fee: string }).overall_fee)) / 1e18;

/** The execution's revert reason, or null when it ran. */
const revertOf = (result: Record<string, unknown>): string | null =>
  (result.transaction_trace as { execute_invocation?: { revert_reason?: string } }).execute_invocation?.revert_reason ??
  null;

/** An authenticator's passkey on the live app: authenticator data with user present and verified, then client data. */
const createPasskey = () => {
  const origin = "https://play.realms.party";
  const rpId = "play.realms.party";
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const x = publicKey.export({ format: "jwk" }).x!;
  const owner: PasskeyOwner = { origin, rpId, publicKeyX: `0x${Buffer.from(x, "base64url").toString("hex")}` };
  const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest();
  const signHash = (executionHash: string) => {
    const authenticatorData = new Uint8Array([...sha256(Buffer.from(rpId)), 0x1d, 0, 0, 0, 0]);
    const challenge = Buffer.from(passkeyChallenge(executionHash)).toString("base64url");
    const clientDataJSON = Buffer.from(
      `{"type":"webauthn.get","challenge":"${challenge}","origin":"${origin}","crossOrigin":false}`,
    );
    // ECDSA with SHA-256 over authenticator data and the client data's hash, DER-encoded, as a browser returns it.
    const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), privateKey);
    return { authenticatorData, clientDataJSON: new Uint8Array(clientDataJSON), signature: new Uint8Array(signature) };
  };
  return { owner, sign: signHash };
};

/** A recent block's first version-3 invoke sender: some deployed account, whose own validation is skipped. */
const anyMainnetAccount = async (provider: RpcProvider): Promise<string> => {
  const head = await provider.getBlockNumber();
  for (let block = head; block > head - 20; block -= 1) {
    const { transactions } = await provider.getBlockWithTxs(block);
    const sender = transactions
      .map((transaction) => transaction as { type?: string; version?: string; sender_address?: string })
      .find((transaction) => transaction.type === "INVOKE" && transaction.version === "0x3")?.sender_address;
    if (sender) return sender;
  }
  throw new Error("no_recent_invoke");
};

/** starknet_simulateTransactions of the relayer's invoke of `calls`, skipping its validation and the fee charge. */
const simulate = async (nodeUrl: string, nonce: string, relayer: string, calls: Call[]) => {
  const transaction = {
    type: "INVOKE",
    version: "0x3",
    sender_address: relayer,
    calldata: transactionCalldata(calls).map((value) => `0x${BigInt(value).toString(16)}`),
    signature: [],
    nonce,
    resource_bounds: {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: "0x2faf0800", max_price_per_unit: "0x0" },
      l1_data_gas: { max_amount: "0x186a0", max_price_per_unit: "0x0" },
    },
    tip: "0x0",
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  const response = await fetch(nodeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_simulateTransactions",
      params: {
        block_id: "latest",
        transactions: [transaction],
        simulation_flags: ["SKIP_VALIDATE", "SKIP_FEE_CHARGE"],
      },
    }),
  });
  const body = (await response.json()) as { result?: Record<string, unknown>[]; error?: unknown };
  if (!body.result) throw new Error(`simulation_refused ${JSON.stringify(body.error)}`);
  return body.result[0]!;
};

/** An account's `__execute__` calldata: the calls, each as (to, selector, calldata). */
const transactionCalldata = (calls: Call[]) => [
  String(calls.length),
  ...calls.flatMap((call) => {
    const calldata = CallData.toCalldata(call.calldata ?? []);
    return [call.contractAddress, hash.getSelectorFromName(call.entrypoint), String(calldata.length), ...calldata];
  }),
];

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

await main();
