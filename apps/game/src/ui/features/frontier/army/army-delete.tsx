import { useEffect, useRef } from "react";

import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { HudConfirm, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { ARMY_MANAGEMENT } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import type { DockArmy } from "../hud/dock-armies";

/**
 * The army's Delete, the kit's red trash right after the panel's name, out of the body's flow and away from its cross
 * (the owner, 4 November); none for a viewer, who orders no army.
 */
export const ArmyDeleteButton = ({ army, onPress }: { army: DockArmy; onPress: () => void }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const busy = useInFlight("army", army.explorerId) !== undefined;
  if (!ordersAllowed) return null;
  return (
    <HudIconButton
      icon="trash"
      label={ARMY_MANAGEMENT.remove}
      kind="danger"
      size="sm"
      disabled={busy}
      onClick={onPress}
    />
  );
};

/** What Delete loses, asked before the existing command removes the army for good; the panel closes once it is sent. */
export const ArmyDeleteConfirm = ({
  army,
  onCancel,
  onDeleted,
}: {
  army: DockArmy;
  onCancel: () => void;
  onDeleted: () => void;
}) => {
  const { setup, account } = useGame();
  const busy = useInFlight("army", army.explorerId) !== undefined;
  const asked = useRef<HTMLDivElement>(null);
  useEffect(() => {
    asked.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const remove = async () => {
    const signer = account.account;
    if (!signer || busy) return;
    try {
      const sent = await sendOnce("army", army.explorerId, { order: "use" }, () =>
        setup.systemCalls.explorer_delete({ signer, explorer_id: army.explorerId }),
      );
      if (sent) onDeleted();
    } catch (error) {
      toast.failed(error, ARMY_MANAGEMENT.deleteFailed);
    }
  };

  return (
    <div ref={asked}>
      <HudConfirm
        question={ARMY_MANAGEMENT.confirmDelete}
        verb={ARMY_MANAGEMENT.remove}
        tone="bad"
        onConfirm={remove}
        onCancel={() => !busy && onCancel()}
      >
        {ARMY_MANAGEMENT.loss}
      </HudConfirm>
    </div>
  );
};
