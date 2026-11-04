/**
 * Rehearses a default wallet's lost-passkey recovery end to end on a Katana devnet forked from mainnet: the real Ready
 * 0.5 class, real transactions and the account's own 7-day clock. It runs the identity Worker's recovery module
 * (startRecovery, finishRecoveries) on a local D1 holding every migration, our guardian code, passkeys signing as an
 * authenticator does, and the devnet's funded account in AVNU's place: it builds and submits outside executions as
 * AVNU does (UDC deploy first while the wallet is undeployed). Each step is checked on chain, and the run exits 1 unless
 * every check holds:
 *
 *   1. passkey A's first send deploys the wallet and runs;
 *   2. a recovery naming passkey B starts (guardian alone): the escape waits, the account's email notice is queued;
 *   3. a second recovery is refused while it waits, and the cron before the 7 days changes nothing;
 *   4. A cancels it (A and the guardian): the escape is gone, and the cron forgets the recovery;
 *   5. a recovery starts again; 7 days pass on chain; the cron finishes it: B owns the wallet, A does not, D1 adopts B,
 *      the address is unchanged;
 *   6. B's send runs; A's is refused.
 *
 *   katana --dev --dev.no-fee --chain-id SN_MAIN --http.port 5091 --http.api starknet,dev --fork.provider <mainnet RPC>
 *   DEVNET_URL=http://127.0.0.1:5091 bun scripts/default-wallet-recovery-rehearsal.ts [out.json]
 *
 * The chain id must be SN_MAIN: the account hashes an outside execution with the chain id its transaction runs on, and
 * Katana's own would not match the signed one. The sends call STRK: Katana 1.7.1 cannot load the forked LORDS class.
 * starknet-devnet 0.6.0 cannot fork mainnet at all (its Sierra compiler panics on a forked class).
 */
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Account, ec, outsideExecution, RpcProvider, typedData, type Call } from "starknet";
import { getPlatformProxy } from "wrangler";

import { createGuardian } from "@realms-world/guardian";
import {
  defaultWalletDeployment,
  defaultWalletSignature,
  passkeyChallenge,
  passkeyOwnerSignature,
  type PasskeyOwner,
} from "@realms-world/identity/wallet";

import { readDefaultWallet } from "../server/default-wallets";
import type { Sponsor, SponsoredExecution } from "../server/sponsor";
import { walletExecutionOf } from "../server/sponsor";
import { isUndeployedWallet } from "../server/wallet-signature";
import { finishRecoveries, readIsOwner, readWalletEscape, startRecovery } from "../server/wallet-recovery";

const ORIGIN = "https://play.realms.party";
const RP_ID = "play.realms.party";
const UDC = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ANY_CALLER = "0x414e595f43414c4c4552";
const WEEK = 7 * 24 * 60 * 60;

const main = async () => {
  const nodeUrl = process.env.DEVNET_URL;
  if (!nodeUrl) throw new Error("DEVNET_URL is required");
  const provider = new RpcProvider({ nodeUrl });
  const chainId = await provider.getChainId();
  const d1 = await localD1();
  const guardian = createGuardian(`0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`);
  const sponsor = devnetSponsor(provider, await relayerOf(nodeUrl, provider), chainId);
  const services = {
    db: d1.db,
    sponsor,
    guardian,
    chainId,
    isDeployed: async (address: string) => !(await isUndeployedWallet(provider, address)),
    readEscape: (address: string) => readWalletEscape(provider, address),
    isOwner: (address: string, owner: PasskeyOwner) => readIsOwner(provider, address, owner),
    succeeded: async (hash: string) => {
      const receipt = await provider.waitForTransaction(hash);
      if (!receipt.isSuccess()) console.log("reverted:", (receipt.value as { revert_reason?: string }).revert_reason);
      return receipt.isSuccess();
    },
  };
  const checks: Record<string, boolean> = {};
  const check = (name: string, held: boolean) => {
    checks[name] = held;
    console.log(`${held ? "ok  " : "FAIL"} ${name}`);
  };

  try {
    const a = emulatedPasskey();
    const b = emulatedPasskey();
    const realmsId = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(31))).toString("hex")}`;
    const wallet = defaultWalletDeployment(a.owner, await guardian.publicKey(), realmsId).address;
    await d1.db
      .prepare(
        `INSERT INTO default_wallets (realms_id, address, deploy_key_x, credential_id, public_key_x, origin, rp_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(realmsId, wallet, a.owner.publicKeyX, "credential-a", a.owner.publicKeyX, ORIGIN, RP_ID, Date.now())
      .run();
    const row = async () => (await readDefaultWallet(d1.db, realmsId))!;
    const recoverWithB = async () =>
      startRecovery(
        services,
        await row(),
        { credentialId: "credential-b", publicKeyX: b.owner.publicKeyX },
        "player@realms.test",
        async () => {},
      );
    const approve: Call = { contractAddress: STRK, entrypoint: "approve", calldata: [UDC, "0", "0"] };
    /** A send signed by `passkey` and the guardian, as the identity Worker's execute endpoint makes it. */
    const send = async (passkey: ReturnType<typeof emulatedPasskey>, calls: Call[]) => {
      const deployment = (await services.isDeployed(wallet))
        ? null
        : defaultWalletDeployment(a.owner, await guardian.publicKey(), realmsId);
      const built = await sponsor.build(wallet, calls, deployment);
      const digest = typedData.getMessageHash(built, wallet);
      const owner = passkeyOwnerSignature(passkey.owner, digest, passkey.sign(digest));
      const cosigned = await guardian.signWalletExecution(chainId, wallet, walletExecutionOf(built, chainId)!);
      const signature = defaultWalletSignature(owner, { publicKey: await guardian.publicKey(), ...cosigned });
      return services.succeeded(await sponsor.execute(wallet, built, signature, deployment));
    };
    const recoveryKept = async () =>
      (await d1.db.prepare(`SELECT 1 AS kept FROM wallet_recoveries WHERE realms_id = ?`).bind(realmsId).first()) !==
      null;

    check(
      "1. A's first send deploys the wallet and runs",
      (await send(a, [approve])) && (await services.isDeployed(wallet)),
    );

    await services.succeeded(await recoverWithB());
    const waiting = await services.readEscape(wallet);
    const notice = await d1.db
      .prepare(`SELECT kind, address FROM wallet_change_notices`)
      .first<{ kind: string; address: string }>();
    check(
      "2. a recovery naming B starts: the escape waits, the email is told",
      waiting.status === "waiting" && notice?.kind === "recovery" && notice.address === wallet,
    );

    const refused = await recoverWithB().then(
      () => false,
      () => true,
    );
    await finishRecoveries(services, Date.now() + 2 * 60 * 60 * 1000);
    check(
      "3. a second recovery is refused, and the cron before the 7 days changes nothing",
      refused &&
        (await recoveryKept()) &&
        (await services.readEscape(wallet)).status === "waiting" &&
        (await services.isOwner(wallet, a.owner)),
    );

    const canceled = await send(a, [{ contractAddress: wallet, entrypoint: "cancel_escape", calldata: [] }]);
    await finishRecoveries(services, Date.now() + 2 * 60 * 60 * 1000);
    check(
      "4. A cancels it, and the cron forgets it",
      canceled &&
        (await services.readEscape(wallet)).status === "none" &&
        !(await recoveryKept()) &&
        (await services.isOwner(wallet, a.owner)),
    );

    await services.succeeded(await recoverWithB());
    await devnet(nodeUrl, "dev_increaseNextBlockTimestamp", [WEEK + 60]);
    await devnet(nodeUrl, "dev_generateBlock", []);
    const ready = await services.readEscape(wallet);
    await finishRecoveries(services, Date.now() + 8 * 24 * 60 * 60 * 1000);
    const adopted = await row();
    check(
      "5. after 7 days the cron finishes it: B owns the wallet, A does not, D1 adopts B, same address",
      ready.status === "ready" &&
        (await services.isOwner(wallet, b.owner)) &&
        !(await services.isOwner(wallet, a.owner)) &&
        (await services.readEscape(wallet)).status === "none" &&
        adopted.credential_id === "credential-b" &&
        adopted.public_key_x === b.owner.publicKeyX &&
        adopted.deploy_key_x === a.owner.publicKeyX &&
        adopted.address === wallet,
    );

    const bSends = await send(b, [approve]);
    const aRefused = await send(a, [approve]).then(
      (ran) => !ran,
      () => true,
    );
    check("6. B's send runs, A's is refused", bSends && aRefused);

    const outcome = { chainId, wallet, checks };
    if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(outcome, null, 2));
    if (Object.values(checks).some((held) => !held)) process.exitCode = 1;
  } finally {
    await d1.dispose();
  }
};

/**
 * The devnet's funded account standing in for AVNU: it builds the SNIP-9 v2 outside execution of the calls (open to any
 * caller, valid for a day) and submits it signed, deploying the wallet first when asked.
 */
const devnetSponsor = (provider: RpcProvider, relayer: Account, chainId: string): Sponsor => ({
  build: async (_wallet, calls) => {
    // Katana's next block may be stamped by the wall clock or by the forked chain's: a day past the later of the two.
    const now = Math.max((await provider.getBlockWithTxHashes("latest")).timestamp, Math.floor(Date.now() / 1000));
    const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex")}`;
    return outsideExecution.getTypedData(
      chainId,
      { caller: ANY_CALLER, execute_after: 1, execute_before: now + 24 * 60 * 60 },
      nonce,
      calls,
      "2",
    ) as SponsoredExecution;
  },
  execute: async (wallet, built, signature, deployment) => {
    const execution = walletExecutionOf(built, chainId)!;
    const deploy: Call[] = deployment
      ? [
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
        ]
      : [];
    const { transaction_hash } = await relayer.execute([
      ...deploy,
      {
        contractAddress: wallet,
        entrypoint: "execute_from_outside_v2",
        calldata: outsideExecution.buildExecuteFromOutsideCallData({
          outsideExecution: {
            caller: execution.caller,
            nonce: execution.nonce,
            execute_after: execution.executeAfter,
            execute_before: execution.executeBefore,
            calls: execution.calls,
          },
          signature,
          signerAddress: wallet,
          version: "2",
        }),
      },
    ]);
    return transaction_hash;
  },
});

/** The devnet's first prefunded account. */
const relayerOf = async (nodeUrl: string, provider: RpcProvider) => {
  const [first] = (await devnet(nodeUrl, "dev_predeployedAccounts", [])) as { address: string; privateKey: string }[];
  return new Account({ provider, address: first!.address, signer: first!.privateKey });
};

const devnet = async (nodeUrl: string, method: string, params: unknown[]) => {
  const response = await fetch(nodeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: unknown };
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result as unknown[];
};

/** A local D1 with every migration, as `wrangler d1 migrations apply` leaves it. */
const localD1 = async () => {
  const directory = mkdtempSync(join(tmpdir(), "recovery-rehearsal-"));
  const configPath = join(directory, "wrangler.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      name: "recovery-rehearsal",
      compatibility_date: "2026-07-30",
      d1_databases: [{ binding: "DB", database_name: "identity", database_id: "00000000-0000-0000-0000-000000000000" }],
    }),
  );
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath, persist: false });
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
  return {
    db: proxy.env.DB,
    dispose: async () => {
      await proxy.dispose();
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

/** An authenticator's passkey on the live app: authenticator data with user present and verified, then client data. */
const emulatedPasskey = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const x = BigInt(`0x${Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url").toString("hex")}`);
  const owner: PasskeyOwner = { origin: ORIGIN, rpId: RP_ID, publicKeyX: `0x${x.toString(16)}` };
  const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest();
  const signHash = (digest: string) => {
    const authenticatorData = new Uint8Array([...sha256(Buffer.from(RP_ID)), 0x1d, 0, 0, 0, 0]);
    const challenge = Buffer.from(passkeyChallenge(digest)).toString("base64url");
    const clientDataJSON = Buffer.from(
      `{"type":"webauthn.get","challenge":"${challenge}","origin":"${ORIGIN}","crossOrigin":false}`,
    );
    const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), privateKey);
    return { authenticatorData, clientDataJSON: new Uint8Array(clientDataJSON), signature: new Uint8Array(signature) };
  };
  return { owner, sign: signHash };
};

await main();
