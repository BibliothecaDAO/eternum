import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SETTINGS_PATH } from "@/shell/profile/settings-route";
import { REALM_NOT_CLAIMED } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";

import { RealmsSheet } from "./realms-sheet";
import type { useRealmLabor } from "./use-realm-labor";

/**
 * Realms over the game's facts: the known Realms' labor today, one Claim all (every ready Realm in one request to the
 * relay, which grants those still in the wallet and names the others), and Add a Realm, which is that Realm's first
 * claim. Nothing shows before the facts are known.
 */
export const FrontierRealms = ({
  labor,
  onRealm,
  onClose,
}: {
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
      await labor.claim(labor.plan.rows.filter((row) => row.state === "ready").map((row) => row.realm.realmId));
    } catch (error) {
      toast.failed(error, "The labor could not be claimed.");
    } finally {
      setSending(false);
    }
  };

  const add = async (realmId: number) => {
    setAdding(true);
    try {
      // A Realm added by its number and refused was never the wallet's to add.
      if ((await labor.claim([realmId])).length > 0) toast.error(REALM_NOT_CLAIMED);
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
      onLinkWallet={() => navigate(SETTINGS_PATH)}
      onClose={onClose}
    />
  );
};
