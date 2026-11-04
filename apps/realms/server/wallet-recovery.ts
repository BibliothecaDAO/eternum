import type { Guardian } from "@realms-world/guardian";
import {
  callsMatch,
  guardianAloneSignature,
  passkeySigner,
  passkeySignerGuid,
  WALLET_RECOVERY,
  walletEscapeOf,
} from "@realms-world/identity/wallet";
import type { AskedCall, WalletEscape } from "@realms-world/identity/wallet";
import { RpcError } from "starknet";
import type { ProviderInterface } from "starknet";

import { ownerOf, walletDeploymentOf } from "./default-wallets";
import type { DefaultWalletRow } from "./default-wallets";
import { SponsorRefusedError, walletExecutionOf } from "./sponsor";
import type { Sponsor } from "./sponsor";

/**
 * A lost passkey's recovery of a default wallet, on the Ready 0.5 account's own owner escape: the guardian starts it,
 * naming the new passkey; the account holds it 7 days, during which the passkey that owns the wallet can cancel it; the
 * guardian then finishes it and the new passkey owns the wallet. Starting takes the account's emailed code
 * (default-wallet-plugin.ts); finishing runs on the minute cron (worker.ts).
 *
 * One recovery per account at a time: its attempt is reserved in `wallet_recoveries` before anything is built, and the
 * row keeps the new passkey (which the chain stores only as a GUID) and the escape's execution (nonce, time window),
 * so the cron can prove what happened to it. The guardian signs only the exact escape call naming that passkey, and the
 * cron finishes only an escape whose new owner is that passkey.
 */

/** The step was proven never sent (nothing signed, or the guardian or the sponsor refused it); its attempt is released. */
export class RecoveryNotSentError extends Error {}

/** A recovery is already under way on this wallet, on chain or not settled yet: another waits for it to end. */
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
  /** Everything an attempt is settled by, read at one block (readAttemptState). */
  readAttemptState(address: string, newOwner: ReturnType<typeof ownerOf>, nonce: string): Promise<AttemptState>;
  /** Whether a submitted transaction succeeded, once it is included. */
  succeeded(transactionHash: string): Promise<boolean>;
}

/** A recovery attempt as `wallet_recoveries` keeps it, with the wallet it is for. */
interface RecoveryAttempt extends DefaultWalletRow {
  attempt: string;
  new_credential_id: string;
  new_public_key_x: string;
  started_at: number;
  nonce: string | null;
  execute_before: number | null;
}

/** An attempt with no execution recorded after this long never had one signed: the request that made it ended. */
const UNSIGNED_MS = 10 * 60 * 1000;

/** The wallet's owner escape on chain; an undeployed wallet has none. */
export const readWalletEscape = async (provider: ProviderInterface, address: string): Promise<WalletEscape> => {
  try {
    return walletEscapeOf(
      await provider.callContract({ contractAddress: address, entrypoint: "get_escape_and_status" }, "latest"),
    );
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND"))
      return { status: "none", readyAt: null, newOwner: null };
    throw error;
  }
};

/**
 * What the chain says of an attempt, all at one identified block: the wallet's escape, whether the new passkey owns it,
 * whether the attempt's nonce is spent, and the block's time. One block, so no answer is older than another: an escape
 * landing between two reads cannot read as "no escape, nonce spent" (a cancel). A wallet the chain proves absent
 * (never deployed) has none of these; any other read failure throws, and the attempt is kept.
 */
export interface AttemptState {
  escape: WalletEscape;
  newOwnerOwns: boolean;
  nonceSpent: boolean;
  /** The block's time, Unix seconds. */
  time: number;
}

export const readAttemptState = async (
  provider: ProviderInterface,
  address: string,
  newOwner: ReturnType<typeof ownerOf>,
  nonce: string,
): Promise<AttemptState> => {
  const block = (await provider.getBlockWithTxHashes("latest")) as { block_number: number; timestamp: number };
  const read = (entrypoint: string, calldata: string[] = []) =>
    provider.callContract({ contractAddress: address, entrypoint, calldata }, block.block_number);
  try {
    const [escape, owns, valid] = await Promise.all([
      read("get_escape_and_status"),
      read("is_owner", passkeySigner(newOwner)),
      read("is_valid_outside_execution_nonce", [nonce]),
    ]);
    return {
      escape: walletEscapeOf(escape),
      newOwnerOwns: BigInt(owns[0] ?? "0") === 1n,
      nonceSpent: BigInt(valid[0] ?? "1") === 0n,
      time: block.timestamp,
    };
  } catch (error) {
    if (!(error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND"))) throw error;
    return {
      escape: { status: "none", readyAt: null, newOwner: null },
      newOwnerOwns: false,
      nonceSpent: false,
      time: block.timestamp,
    };
  }
};

/**
 * Starts the recovery: once no escape stands and `spendCode` has spent the account's emailed code, one attempt is
 * reserved (a second is refused while one is unsettled), the sponsor builds the escape, which must be exactly the call
 * naming the new passkey, its execution and the account's email notice are recorded together, and only then does the
 * guardian sign it alone and the sponsor submit it. A step proven unsent releases the attempt and its notice; a lost
 * answer keeps both, for the cron to settle from the chain.
 */
export const startRecovery = async (
  services: Omit<RecoveryServices, "readAttemptState" | "succeeded">,
  row: DefaultWalletRow,
  passkey: { credentialId: string; publicKeyX: string },
  email: string,
  spendCode: () => Promise<void>,
): Promise<string> => {
  const escape = await services.readEscape(row.address);
  if (escape.status === "waiting" || escape.status === "ready") throw new RecoveryUnderWayError();
  await spendCode();
  const attempt = crypto.randomUUID();
  if (!(await reserveAttempt(services.db, row.realms_id, attempt, passkey))) throw new RecoveryUnderWayError();
  const notSent = async (error: unknown) => {
    await releaseAttempt(services.db, row.realms_id, attempt);
    return new RecoveryNotSentError(error instanceof Error ? error.message : String(error));
  };
  const deployment = await deploymentIfNeeded(services, row);
  const built = await buildExactly(services, row, escapeStart(row, passkey.publicKeyX), deployment).catch(
    async (error: unknown) => {
      throw await notSent(error);
    },
  );
  await recordExecution(services.db, row, attempt, built.execution, email);
  const signature = await services.guardian
    .signWalletExecution(services.chainId, row.address, built.execution)
    .catch(async (error: unknown) => {
      throw await notSent(error);
    });
  try {
    const transactionHash = await services.sponsor.execute(
      row.address,
      built.typedData,
      guardianAloneSignature(signature),
      deployment,
    );
    await services.db
      .prepare(`UPDATE wallet_recoveries SET transaction_hash = ? WHERE realms_id = ? AND attempt = ?`)
      .bind(transactionHash, row.realms_id, attempt)
      .run();
    return transactionHash;
  } catch (error) {
    if (error instanceof SponsorRefusedError) throw await notSent(error);
    throw error;
  }
};

/**
 * The cron's pass over every recovery attempt, each settled only from the chain's evidence: a ready escape whose new
 * owner is the saved passkey is finished and the passkey adopted; one naming another owner is never finished (it is
 * reported, and the owner can cancel it); the new passkey already owning the wallet is adopted (a finish whose adoption
 * was cut short); an attempt is forgotten once it provably never ran (no execution signed, or its nonce unspent past its
 * window), ran and was canceled (nonce spent, no escape), or expired. Safe to run again at any point.
 */
export const finishRecoveries = async (services: RecoveryServices, now = Date.now()) => {
  const { results } = await services.db
    .prepare(
      `SELECT d.realms_id, d.address, d.deploy_key_x, d.credential_id, d.public_key_x, d.origin, d.rp_id,
         r.attempt, r.credential_id AS new_credential_id, r.public_key_x AS new_public_key_x,
         r.started_at, r.nonce, r.execute_before
       FROM wallet_recoveries r JOIN default_wallets d ON d.realms_id = r.realms_id`,
    )
    .all<RecoveryAttempt>();
  for (const attempt of results) {
    try {
      await settleAttempt(services, attempt, now);
    } catch (error) {
      console.error("wallet_recovery_settle_failed", {
        realmsId: attempt.realms_id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
};

const settleAttempt = async (services: RecoveryServices, attempt: RecoveryAttempt, now: number) => {
  if (attempt.nonce === null) {
    // The guardian signs only after the execution is recorded: none recorded means none was ever sent.
    if (now - attempt.started_at > UNSIGNED_MS) await settle(services.db, attempt, null);
    return;
  }
  const newOwner = { ...ownerOf(attempt), publicKeyX: attempt.new_public_key_x };
  const adopt = { credentialId: attempt.new_credential_id, publicKeyX: attempt.new_public_key_x };
  const state = await services.readAttemptState(attempt.address, newOwner, attempt.nonce);
  if (state.escape.status === "waiting" || state.escape.status === "ready") {
    if (state.escape.newOwner !== passkeySignerGuid(newOwner)) {
      console.error("wallet_recovery_target_mismatch", {
        realmsId: attempt.realms_id,
        escapeOwner: state.escape.newOwner,
      });
      return;
    }
    if (state.escape.status === "waiting") return;
    if (await services.succeeded(await finishEscape(services, attempt))) await settle(services.db, attempt, adopt);
    return;
  }
  if (state.newOwnerOwns) return settle(services.db, attempt, adopt);
  if (isProvenOver(state, attempt.execute_before)) await settle(services.db, attempt, null);
};

/**
 * With no escape standing at that block, the attempt is over when its escape expired, or its execution ran (nonce
 * spent: started, then canceled) or never can (the block is past its window, nonce unspent).
 */
const isProvenOver = (state: AttemptState, executeBefore: number | null) =>
  state.escape.status === "expired" || state.nonceSpent || (executeBefore !== null && state.time >= executeBefore);

/** The escape's finish: the exact call, the guardian alone, the sponsor paying. */
const finishEscape = async (services: RecoveryServices, row: DefaultWalletRow) => {
  const finish: AskedCall = { contractAddress: row.address, entrypoint: WALLET_RECOVERY.finish, calldata: [] };
  const built = await buildExactly(services, row, finish, null);
  const signature = await services.guardian.signWalletExecution(services.chainId, row.address, built.execution);
  return services.sponsor.execute(row.address, built.typedData, guardianAloneSignature(signature), null);
};

/** `trigger_escape_owner(Signer::Webauthn(new passkey))` on the wallet itself. */
const escapeStart = (row: DefaultWalletRow, publicKeyX: string): AskedCall => ({
  contractAddress: row.address,
  entrypoint: WALLET_RECOVERY.start,
  calldata: passkeySigner({ ...ownerOf(row), publicKeyX }),
});

const deploymentIfNeeded = async (
  services: Pick<RecoveryServices, "isDeployed" | "guardian">,
  row: DefaultWalletRow,
) => ((await services.isDeployed(row.address)) ? null : walletDeploymentOf(row, await services.guardian.publicKey()));

/**
 * The sponsor's build of one recovery call, accepted only when it is that exact call (callsMatch, the rule a send is
 * checked by): the guardian, a recovery step's only signer, never signs what a sponsor substituted.
 */
const buildExactly = async (
  services: Pick<RecoveryServices, "sponsor" | "chainId">,
  row: DefaultWalletRow,
  call: AskedCall,
  deployment: ReturnType<typeof walletDeploymentOf> | null,
) => {
  const typedData = await services.sponsor.build(
    row.address,
    [{ contractAddress: call.contractAddress, entrypoint: call.entrypoint, calldata: [...call.calldata] }],
    deployment,
  );
  const execution = walletExecutionOf(typedData, services.chainId);
  if (!execution || !callsMatch(execution.calls, [call])) throw new Error("sponsor_built_another_call");
  return { typedData, execution };
};

/** One attempt per account: reserved only while none is unsettled. */
const reserveAttempt = async (
  db: D1Database,
  realmsId: string,
  attempt: string,
  passkey: { credentialId: string; publicKeyX: string },
) =>
  (
    await db
      .prepare(
        `INSERT OR IGNORE INTO wallet_recoveries (realms_id, attempt, credential_id, public_key_x, started_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(realmsId, attempt, passkey.credentialId, passkey.publicKeyX, Date.now())
      .run()
  ).meta.changes === 1;

/**
 * The escape's execution (its nonce and window, to prove later whether it ran) and the account's email notice, kept
 * together before anything is signed; the notice's id is the attempt, so it is delivered once whatever happens next.
 */
const recordExecution = (
  db: D1Database,
  row: DefaultWalletRow,
  attempt: string,
  execution: { nonce: string; executeBefore: string },
  email: string,
) =>
  db.batch([
    db
      .prepare(`UPDATE wallet_recoveries SET nonce = ?, execute_before = ? WHERE realms_id = ? AND attempt = ?`)
      .bind(execution.nonce, Number(BigInt(execution.executeBefore)), row.realms_id, attempt),
    db
      .prepare(`INSERT OR IGNORE INTO wallet_change_notices (id, email, address, kind) VALUES (?, ?, ?, 'recovery')`)
      .bind(attempt, email, row.address),
  ]);

/** This attempt, proven unsent: it and its notice go; any other attempt is untouched. */
const releaseAttempt = (db: D1Database, realmsId: string, attempt: string) =>
  db.batch([
    db.prepare(`DELETE FROM wallet_recoveries WHERE realms_id = ? AND attempt = ?`).bind(realmsId, attempt),
    db.prepare(`DELETE FROM wallet_change_notices WHERE id = ?`).bind(attempt),
  ]);

/** The attempt ended: the wallet's owner becomes the new passkey when it won, and the attempt is forgotten. */
const settle = (
  db: D1Database,
  attempt: RecoveryAttempt,
  adopted: { credentialId: string; publicKeyX: string } | null,
) =>
  db.batch([
    ...(adopted
      ? [
          db
            .prepare(`UPDATE default_wallets SET credential_id = ?, public_key_x = ? WHERE realms_id = ?`)
            .bind(adopted.credentialId, adopted.publicKeyX, attempt.realms_id),
        ]
      : []),
    db
      .prepare(`DELETE FROM wallet_recoveries WHERE realms_id = ? AND attempt = ?`)
      .bind(attempt.realms_id, attempt.attempt),
  ]);
