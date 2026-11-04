import { CANCEL, WALLET_WORDS } from "@/ui/design-system/kit/words";
import { formatDate } from "@bibliothecadao/types";
import type { NewPasskey } from "@realms-world/identity";
import { WALLET_RECOVERY, walletEscapeOf, type WalletEscape } from "@realms-world/identity/wallet";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { RpcError } from "starknet";

import { identityUsername, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { l2Provider } from "@/runtime/l2-rpc";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { failureSentence } from "@/ui/modules/identity/identity-failures";
import { createPasskey } from "@/ui/modules/identity/passkey";

import { Loading } from "../loading";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

/**
 * The Realms wallet's recovery as the wallet itself holds it (apps/realms/server/wallet-recovery.ts): under way, with the
 * day the new passkey takes over and the owner's Cancel (the passkey that holds the wallet now signs it), or the way in
 * for a player whose passkey is lost.
 */
export const RealmsWalletRecovery = ({ address, onRecover }: { address: string; onRecover: () => void }) => {
  const escape = useWalletEscape(address);
  const [cancelling, setCancelling] = useState(false);
  if (!escape.value) return null;
  const { status, readyAt } = escape.value;
  if (status !== "waiting" && status !== "ready")
    return (
      <span>
        <AppButton kind="quiet" icon="help" onClick={onRecover}>
          {WALLET_WORDS.lostPasskey}
        </AppButton>
      </span>
    );
  return (
    <div className="flex flex-col gap-2.5">
      <AppNotice tone="warn" line={WALLET_WORDS.recoveryUnderWay(formatDate(readyAt ?? undefined))} />
      {cancelling ? (
        <Suspense fallback={<Loading />}>
          <WalletSign
            owner={address}
            calls={[{ contractAddress: address, entrypoint: WALLET_RECOVERY.cancel, calldata: [] }]}
            onLanded={() => {
              setCancelling(false);
              escape.read();
            }}
          />
        </Suspense>
      ) : (
        <span>
          <AppButton kind="quiet" tone="bad" icon="close" onClick={() => setCancelling(true)}>
            {WALLET_WORDS.cancelRecovery}
          </AppButton>
        </span>
      )}
    </div>
  );
};

/**
 * Recover your wallet: what happens, then a new passkey made on this device; the emailed code follows (`onPasskey`). A
 * device that still holds the wallet's passkey is told so rather than made to overwrite it.
 */
export const RecoverStart = ({
  replacing,
  onPasskey,
  onCancel,
}: {
  /** The passkey that owns the wallet now. */
  replacing: string;
  onPasskey: (passkey: NewPasskey) => void;
  onCancel: () => void;
}) => {
  const session = useIdentitySessionStore((state) => state.session);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return null;
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const { realmsId, email } = session.user;
      onPasskey(await createPasskey({ realmsId, email, name: identityUsername(session) ?? email }, replacing));
    } catch (cause) {
      setError(failureSentence("recover", cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="text-app-heading text-app-ink">{WALLET_WORDS.recoverTitle}</p>
      <p className="text-app-body text-app-muted">{WALLET_WORDS.recoverLine}</p>
      <AppButton kind="primary" icon="lock" busy={busy ? WALLET_WORDS.confirmPasskey : undefined} onClick={make}>
        {WALLET_WORDS.makeNewPasskey}
      </AppButton>
      {error && <p className="text-app-body text-app-bad">{error}</p>}
      <span>
        <AppButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </AppButton>
      </span>
    </>
  );
};

/** The wallet's owner escape, read from the chain on open and again after a cancel; an undeployed wallet has none. */
const useWalletEscape = (address: string) => {
  const [value, setValue] = useState<WalletEscape | null>(null);
  const read = useCallback(() => {
    void l2Provider()
      .callContract({ contractAddress: address, entrypoint: "get_escape_and_status" }, "latest")
      .then((result) => setValue(walletEscapeOf(result)))
      .catch((error: unknown) => {
        if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND"))
          setValue({ status: "none", readyAt: null, newOwner: null });
        else console.error("wallet_escape_read_failed", error);
      });
  }, [address]);
  useEffect(() => {
    read();
  }, [read]);
  return { value, read };
};
