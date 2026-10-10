import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Sheet } from "@/ui/design-system/kit/sheet";
import { REALMS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { ServiceFailure } from "@/shell/service-failure";
import { extractReadableErrorMessage } from "@/utils/error-message";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { RealmsSheet } from "./realms-sheet";
import { claimRealmLabor, type useRealmLabor } from "./use-realm-labor";

/**
 * Realms over the game's facts: the held Realms' labor today and one Claim all, each ready Realm claimed in turn
 * through the relay. A failed read of the wallet's Realms is said as the service it is; nothing shows before the
 * facts are known.
 */
export const FrontierRealms = ({
  realm,
  labor: { labor, realms },
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
  if (realms.isError)
    return (
      <Sheet label={REALMS} onClose={onClose}>
        <ServiceFailure service="realms" error={realms.error} retry={() => void realms.refetch()} />
      </Sheet>
    );
  if (!labor) return null;

  const claimAll = async () => {
    setSending(true);
    try {
      for (const row of labor.plan.rows) if (row.state === "ready") await claimRealmLabor(row.realm.realmId, realm);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The labor could not be claimed."));
    } finally {
      setSending(false);
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
      onClaim={() => void claimAll()}
      onRealm={onRealm}
      onLinkWallet={() => navigate("/profile/account")}
      onClose={onClose}
    />
  );
};
