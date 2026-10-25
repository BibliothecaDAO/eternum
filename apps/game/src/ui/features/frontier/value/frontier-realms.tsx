import { useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { RealmsSheet } from "./realms-sheet";
import type { useRealmLabor } from "./use-realm-labor";

export const FrontierRealms = ({
  labor,
  onRealm,
  onClose,
}: {
  labor: ReturnType<typeof useRealmLabor>;
  onRealm: () => void;
  onClose: () => void;
}) => {
  const [sending, setSending] = useState(false);
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
    <RealmsSheet
      plan={labor.plan}
      dailyAmount={labor.dailyAmount}
      secondsLeft={labor.secondsLeft}
      sending={sending}
      onClaim={() => void claim()}
      onRealm={onRealm}
      onClose={onClose}
    />
  );
};
