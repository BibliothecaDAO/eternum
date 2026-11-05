import { defaultWalletDeployment } from "@realms-world/identity/wallet";
import type { PasskeyOwner } from "@realms-world/identity/wallet";

/**
 * An account's default wallet as `default_wallets` keeps it (migration 0028): its address, the passkey key it was
 * deployed with, and the passkey that owns it today, with the origin and relying party both were made on.
 */
export interface DefaultWalletRow {
  realms_id: string;
  address: string;
  deploy_key_x: string;
  credential_id: string;
  public_key_x: string;
  origin: string;
  rp_id: string;
}

export const readDefaultWallet = (db: D1Database, realmsId: string) =>
  db
    .prepare(
      `SELECT realms_id, address, deploy_key_x, credential_id, public_key_x, origin, rp_id
       FROM default_wallets WHERE realms_id = ?`,
    )
    .bind(realmsId)
    .first<DefaultWalletRow>();

/** The passkey that owns the wallet today, as the account's signer names it. */
export const ownerOf = (row: DefaultWalletRow): PasskeyOwner => ({
  origin: row.origin,
  rpId: row.rp_id,
  publicKeyX: row.public_key_x,
});

/** What deploys the wallet at its address: its first passkey's constructor, whoever owns it now. */
export const walletDeploymentOf = (row: DefaultWalletRow, guardianPublicKey: string) =>
  defaultWalletDeployment({ ...ownerOf(row), publicKeyX: row.deploy_key_x }, guardianPublicKey, row.realms_id);
