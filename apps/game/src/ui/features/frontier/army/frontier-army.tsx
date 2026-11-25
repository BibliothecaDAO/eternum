import { ArmyOathEffects, ArmyOathSockets } from "./oath-slots";
import { ArmyRelicSlots } from "../relics/army-relic-slots";
import { useState } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useArmySpireStatus } from "../spire-card";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { ArmyDetail } from "./army-panel";
import { ArmyRefill, sellsStamina } from "./army-refill";
import { ArmyDeleteButton, ArmyDeleteConfirm } from "./army-delete";
import { useFragmentsHeld } from "../value/fragments";

export const FrontierArmy = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  return army ? <ArmyPanel key={army.explorerId} army={army} onClose={onClose} /> : null;
};

const ArmyPanel = ({ army, onClose }: { army: DockArmy; onClose: () => void }) => {
  const spire = useArmySpireStatus(army.explorerId);
  const [deleting, setDeleting] = useState(false);
  const held = useFragmentsHeld();
  if (!army.stamina) return null;
  const refill = sellsStamina(army, held) ? <ArmyRefill army={army} look="price" /> : undefined;
  return (
    <HudSheet label={army.label} onClose={onClose}>
      <ArmyDetail army={{ ...army, stamina: army.stamina }} />
      <ArmyOathEffects explorerId={army.explorerId} />
      <ArmyRelicSlots explorerId={army.explorerId} />
      {deleting && <ArmyDeleteConfirm army={army} onCancel={() => setDeleting(false)} onDeleted={onClose} />}
      <HudWindowFoot note={<ArmyOathSockets explorerId={army.explorerId} />}>
        {refill}
        {spire}
        <ArmyDeleteButton army={army} onPress={() => setDeleting(true)} />
      </HudWindowFoot>
    </HudSheet>
  );
};
