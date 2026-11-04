import type { Guardian } from "@realms-world/guardian";
import { guardianAloneSignature, passkeySigner, WALLET_RECOVERY, walletEscapeOf } from "@realms-world/identity/wallet";
import type { WalletEscape } from "@realms-world/identity/wallet";
import { RpcError } from "starknet";
import type { Call, ProviderInterface } from "starknet";

import { ownerOf, walletDeploymentOf } from "./default-wallets";
import type { DefaultWalletRow } from "./default-wallets";
import { SponsorRefusedError, walletExecutionOf } from "./sponsor";
import type { Sponsor } from "./sponsor";

/**
 * A lost passkey's recovery of a default wallet, on the Ready 0.5 account's own owner escape: the guardian starts it,
 * naming the new passkey; the account holds it 7 days, during which the passkey that owns the wallet can cancel it; the
 * guardian then finishes it and the new passkey owns the wallet. Starting takes the account's emailed code
 * (default-wallet-plugin.ts); finishing runs on the minute cron (worker.ts). The chain answers whether an escape
 * stands; `wallet_recoveries` only remembers the new passkey, which the chain keeps as a hash.
 */

/** The guardian would not sign the step: nothing was sent. */
class GuardianRefusedError extends Error {}

/** The recovery's escape was proven never sent (the guardian or the sponsor refused it); its passkey is forgotten. */
export class RecoveryNotSentError extends Error {}

/** A recovery is already under way on this wallet: a second one waits for it to end. */
export class RecoveryUnderWayError extends Error {
  constructor() {
    super("recovery_under_way");
  }
}

export interface RecoveryServices {
  db: D1Database;
  sponsor: Sponsor;
  guardian: Pick<Guardian, "publicKey" | "signWalletExecution">;
  /** The environment chain's id, as a hex felt. */
  chainId: string;
  isDeployed(address: string): Promise<boolean>;
  readEscape(address: string): Promise<WalletEscape>;
  /** Whether the passkey is an owner of the wallet now, on the account's own `is_owner`. */
  isOwner(address: string, owner: ReturnType<typeof ownerOf>): Promise<boolean>;
  /** Whether a submitted transaction succeeded, once it is included. */
  succeeded(transactionHash: string): Promise<boolean>;
}

/** A started recovery whose escape the chain does not show after this long never landed, or was canceled. */
const LANDING_MS = 60 * 60 * 1000;

/** The wallet's owner escape on chain; an undeployed wallet has none. */
export const readWalletEscape = async (provider: ProviderInterface, address: string): Promise<WalletEscape> => {
  try {
    return walletEscapeOf(
      await provider.callContract({ contractAddress: address, entrypoint: "get_escape_and_status" }, "latest"),
    );
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND")) return { status: "none", readyAt: null };
    throw error;
  }
};

/** `is_owner(Signer::Webauthn(passkey))` on the wallet. */
export const readIsOwner = async (provider: ProviderInterface, address: string, owner: ReturnType<typeof ownerOf>) => {
  const [answer] = await provider.callContract({
    contractAddress: address,
    entrypoint: "is_owner",
    calldata: passkeySigner(owner),
  });
  return answer !== undefined && BigInt(answer) === 1n;
};

/**
 * Starts the recovery: once no escape stands and `spendCode` has spent the account's emailed code, the new passkey is
 * kept, the guardian alone signs the escape naming it, and the sponsor submits it (deploying the wallet first if it
 * never was); then the account's email is told. A refusal forgets the passkey. A lost answer keeps it, with the email
 * told, because the escape may stand: the cron then finishes it or, seeing none on chain, forgets it.
 */
export const startRecovery = async (
  services: Omit<RecoveryServices, "isOwner" | "succeeded">,
  row: DefaultWalletRow,
  passkey: { credentialId: string; publicKeyX: string },
  email: string,
  spendCode: () => Promise<void>,
): Promise<string> => {
  const escape = await services.readEscape(row.address);
  if (escape.status === "waiting" || escape.status === "ready") throw new RecoveryUnderWayError();
  await spendCode();
  await keepRecovery(services.db, row.realms_id, passkey);
  const newOwner = { ...ownerOf(row), publicKeyX: passkey.publicKeyX };
  try {
    const transactionHash = await runAsGuardian(services, row, {
      contractAddress: row.address,
      entrypoint: WALLET_RECOVERY.start,
      calldata: passkeySigner(newOwner),
    });
    await tellRecovery(services.db, row, email);
    return transactionHash;
  } catch (error) {
    if (!(error instanceof SponsorRefusedError || error instanceof GuardianRefusedError)) {
      await tellRecovery(services.db, row, email);
      throw error;
    }
    await forgetRecovery(services.db, row.realms_id);
    throw new RecoveryNotSentError(error.message);
  }
};

/**
 * The cron's pass over recoveries started over an hour ago: a ready escape is finished and its passkey adopted; one the
 * chain no longer holds was canceled, expired or never landed, and is forgotten, unless the new passkey already owns the
 * wallet (a finish whose adoption was cut short), which is adopted. Safe to run again at any point.
 */
export const finishRecoveries = async (services: RecoveryServices, now = Date.now()) => {
  const { results } = await services.db
    .prepare(
      `SELECT d.realms_id, d.address, d.deploy_key_x, d.credential_id, d.public_key_x, d.origin, d.rp_id,
         r.credential_id AS new_credential_id, r.public_key_x AS new_public_key_x
       FROM wallet_recoveries r JOIN default_wallets d ON d.realms_id = r.realms_id WHERE r.started_at <= ?`,
    )
    .bind(now - LANDING_MS)
    .all<DefaultWalletRow & { new_credential_id: string; new_public_key_x: string }>();
  for (const recovery of results) {
    try {
      await finishOne(services, recovery, {
        credentialId: recovery.new_credential_id,
        publicKeyX: recovery.new_public_key_x,
      });
    } catch (error) {
      console.error("wallet_recovery_finish_failed", {
        realmsId: recovery.realms_id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
};

const finishOne = async (
  services: RecoveryServices,
  row: DefaultWalletRow,
  passkey: { credentialId: string; publicKeyX: string },
) => {
  const escape = await services.readEscape(row.address);
  if (escape.status === "waiting") return;
  if (escape.status === "ready") {
    const finished = await runAsGuardian(services, row, {
      contractAddress: row.address,
      entrypoint: WALLET_RECOVERY.finish,
      calldata: [],
    });
    if (!(await services.succeeded(finished))) return;
  }
  const adopted = await services.isOwner(row.address, { ...ownerOf(row), publicKeyX: passkey.publicKeyX });
  await settleRecovery(services.db, row.realms_id, adopted ? passkey : null);
};

/** One recovery step the guardian signs alone, built and paid for by the sponsor. */
const runAsGuardian = async (
  services: Omit<RecoveryServices, "isOwner" | "succeeded">,
  row: DefaultWalletRow,
  call: Call,
): Promise<string> => {
  const guardianPublicKey = await services.guardian.publicKey();
  const deployment = (await services.isDeployed(row.address)) ? null : walletDeploymentOf(row, guardianPublicKey);
  const typedData = await services.sponsor.build(row.address, [call], deployment);
  const execution = walletExecutionOf(typedData, services.chainId);
  if (!execution) throw new Error("sponsor_built_no_outside_execution");
  const signature = await services.guardian
    .signWalletExecution(services.chainId, row.address, execution)
    .catch((error: unknown) => {
      throw new GuardianRefusedError(error instanceof Error ? error.message : String(error));
    });
  return services.sponsor.execute(row.address, typedData, guardianAloneSignature(signature), deployment);
};

/** The new passkey kept before its escape is sent, replacing any earlier attempt. */
const keepRecovery = (db: D1Database, realmsId: string, passkey: { credentialId: string; publicKeyX: string }) =>
  db
    .prepare(
      `INSERT OR REPLACE INTO wallet_recoveries (realms_id, credential_id, public_key_x, started_at) VALUES (?, ?, ?, ?)`,
    )
    .bind(realmsId, passkey.credentialId, passkey.publicKeyX, Date.now())
    .run();

const forgetRecovery = (db: D1Database, realmsId: string) =>
  db.prepare(`DELETE FROM wallet_recoveries WHERE realms_id = ?`).bind(realmsId).run();

/** The account's email is told a recovery of its wallet started. */
const tellRecovery = (db: D1Database, row: DefaultWalletRow, email: string) =>
  db
    .prepare(`INSERT INTO wallet_change_notices (id, email, address, kind) VALUES (?, ?, ?, 'recovery')`)
    .bind(crypto.randomUUID(), email, row.address)
    .run();

/** The recovery ended: the wallet's owner becomes the new passkey when it won, and the recovery is forgotten. */
const settleRecovery = (
  db: D1Database,
  realmsId: string,
  adopted: { credentialId: string; publicKeyX: string } | null,
) =>
  db.batch([
    ...(adopted
      ? [
          db
            .prepare(`UPDATE default_wallets SET credential_id = ?, public_key_x = ? WHERE realms_id = ?`)
            .bind(adopted.credentialId, adopted.publicKeyX, realmsId),
        ]
      : []),
    db.prepare(`DELETE FROM wallet_recoveries WHERE realms_id = ?`).bind(realmsId),
  ]);
