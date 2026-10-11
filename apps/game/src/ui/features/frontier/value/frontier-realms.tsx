import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { REALM_NOT_CLAIMED } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { RealmsSheet } from "./realms-sheet";
import { claimRealmLabor, type useRealmLabor } from "./use-realm-labor";

/**
 * Realms over the game's facts: the known Realms' labor today, one Claim all (every ready Realm in one request to the
 * relay), and Add a Realm, which is that Realm's first claim. Nothing shows before the facts are known.
 */
export const FrontierRealms = ({
  realm,
  labor,
  onRealm,
  onClose,
}: {
  realm: NativeRows["Structure"];
  labor: ReturnType<typeof useRealmLabor>;
  /** To the Realm board, where labor is spent. */
  onRealm: () => void;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!labor) return null;

  const claimAll = async () => {
    setSending(true);
    try {
      const ready = labor.plan.rows.filter((row) => row.state === "ready").map((row) => row.realm.realmId);
      await claimRealmLabor(ready, realm);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The labor could not be claimed."));
    } finally {
      setSending(false);
    }
  };

  const add = async (realmId: number) => {
    setAdding(true);
    try {
      await claimRealmLabor([realmId], realm);
    } catch {
      toast.error(REALM_NOT_CLAIMED);
    } finally {
      setAdding(false);
    }
  };

  return (
    <RealmsSheet
      wallet={labor.wallet}
      plan={labor.plan}
      perRealm={labor.perRealm}
      cap={labor.cap}
      labor={labor.held}
      secondsLeft={labor.secondsLeft}
      sending={sending}
      adding={adding}
      onClaim={() => void claimAll()}
      onAdd={(realmId) => void add(realmId)}
      onRealm={onRealm}
      onLinkWallet={() => navigate("/profile/account")}
      onClose={onClose}
    />
  );
};
