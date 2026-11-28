import { ArmyOathEffects, ArmyOathSockets } from "./oath-slots";
import { ArmyRelicSlots } from "../relics/army-relic-slots";
import { useState } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { armyStaminaCosts, troopFigures, type ArmyStaminaCosts } from "../deploy/troop-figures";
import { useArmySpireStatus } from "../spire-card";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { ArmyDetail } from "./army-panel";
import { ArmyRefill, sellsStamina } from "./army-refill";
import { ArmyDeleteButton, ArmyDeleteConfirm } from "./army-delete";
import { useFragmentsHeld } from "../value/fragments";

export const FrontierArmy = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  const row = army
    ? setup.store.get("ExplorerTroops", { game_id: realm.game_id, explorer_id: BigInt(army.explorerId) })
    : undefined;
  return army ? (
    <ArmyPanel
      key={army.explorerId}
      army={army}
      figures={troopFigures(setup.store, realm.game_id)}
      staminaCosts={row ? armyStaminaCosts(setup.store, row) : undefined}
      onClose={onClose}
    />
  ) : null;
};

const ArmyPanel = ({
  army,
  figures,
  staminaCosts,
  onClose,
}: {
  army: DockArmy;
  figures: ReturnType<typeof troopFigures>;
  staminaCosts: ArmyStaminaCosts | undefined;
  onClose: () => void;
}) => {
  const spire = useArmySpireStatus(army.explorerId);
  const [deleting, setDeleting] = useState(false);
  const held = useFragmentsHeld();
  if (!army.stamina) return null;
  const refill = sellsStamina(army, held) ? <ArmyRefill army={army} look="price" /> : undefined;
  return (
    <HudSheet label={army.label} onClose={onClose}>
      <ArmyDetail
        army={{ ...army, category: army.troopsFact.category, figures, staminaCosts, stamina: army.stamina }}
      />
      <ArmyOathEffects explorerId={army.explorerId} />
      <ArmyRelicSlots explorerId={army.explorerId} />
      {deleting && <ArmyDeleteConfirm army={army} onCancel={() => setDeleting(false)} onDeleted={onClose} />}
      <HudWindowFoot note={<ArmyOathSockets explorerId={army.explorerId} />}>
        <span className="army-foot__verbs">
          {refill}
          {spire}
          <ArmyDeleteButton army={army} onPress={() => setDeleting(true)} />
        </span>
      </HudWindowFoot>
    </HudSheet>
  );
};
