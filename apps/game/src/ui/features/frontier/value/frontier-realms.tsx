import { useState } from "react";
import { useHeldRealms } from "@/hooks/use-holdings";
import { useAlertsAsk } from "@/shell/profile/alerts-ask";
import { toast } from "@/ui/features/event-feed/notify";
import type { LaborHome } from "./realm-labor";
import { RealmsSheet } from "./realms-sheet";
import type { useRealmLabor } from "./use-realm-labor";

export const FrontierRealms = ({
  labor,
  onClose,
}: {
  labor: ReturnType<typeof useRealmLabor>;
  onClose: () => void;
}) => {
  const [sending, setSending] = useState(false);
  const ask = useAlertsAsk();
  const map = useHeldRealmMap(labor?.home ?? null);
  if (!labor) return null;
  const claim = async () => {
    setSending(true);
    try {
      await labor.claim();
    } catch (error) {
      toast.failed(error, "The labor could not be claimed.");
    } finally {
      setSending(false);
    }
  };
  return (
    <RealmsSheet labor={labor} map={map} ask={ask} sending={sending} onClaim={() => void claim()} onClose={onClose} />
  );
};

/** A held Realm home's map, from the account's held-Realms answer the Realm step read too; null for any other home. */
const useHeldRealmMap = (home: LaborHome | null): string | null => {
  const { held } = useHeldRealms();
  if (home?.kind !== "realm") return null;
  return held.data?.find((realm) => realm.realmId === home.realmId)?.map ?? null;
};
