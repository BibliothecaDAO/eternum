import { useCallback, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { useGame } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { withRealmActionSubmitTimeout } from "./realm-action-submit-timeout";

/** The empire panel upgrades any owned realm through the shared action path. */
export const useRealmActions = () => {
  const {
    account,
    setup: { systemCalls },
  } = useGame();
  const [pendingRealmId, setPendingRealmId] = useState<ID | null>(null);
  const fireUpgrade = useCallback(
    async (realmId: ID) => {
      setPendingRealmId(realmId);
      try {
        await withRealmActionSubmitTimeout(
          systemCalls.upgrade_realm({ signer: account.account, realm_entity_id: realmId }),
        );
      } catch (error) {
        toast.error(extractReadableErrorMessage(error, "Failed to upgrade the realm."));
        throw error;
      } finally {
        setPendingRealmId((current) => (current === realmId ? null : current));
      }
    },
    [account.account, systemCalls],
  );
  return { pendingRealmId, fireUpgrade };
};
