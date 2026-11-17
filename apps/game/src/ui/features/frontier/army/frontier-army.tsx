import { ArmyOathPick } from "./oath-pick";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import { TroopOathSlots } from "./oath-slots";
import { ArmyRelicSlots } from "../relics/army-relic-slots";
import { useState } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useArmyRevealYield } from "../frontier-reveal-yield";
import { useArmySpireStatus } from "../spire-card";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { ArmyDetail } from "./army-panel";
import { ArmyDeleteButton, ArmyDeleteConfirm } from "./army-delete";

export const FrontierArmy = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  return army ? <ArmyPanel key={army.explorerId} army={army} onClose={onClose} /> : null;
};

const ArmyPanel = ({ army, onClose }: { army: DockArmy; onClose: () => void }) => {
  const { store } = useNativeFacts(["ArmyProgress"]);
  const progress = store.get("ArmyProgress", {
    game_id: configManager.getActiveGameId(),
    explorer_id: army.explorerId,
  });
  const waiting = progress !== undefined && progress.oath_pick !== 0;
  const revealYield = useArmyRevealYield(army);
  const spire = useArmySpireStatus(army.explorerId);
  const [deleting, setDeleting] = useState(false);
  if (!army.stamina) return null;
  return (
    <HudSheet
      label={army.label}
      beside={!waiting && <ArmyDeleteButton army={army} onPress={() => setDeleting(true)} />}
      onClose={onClose}
    >
      {waiting ? (
        <ArmyOathPick key={progress.oath_pick} explorerId={army.explorerId} progress={progress} />
      ) : (
        <>
          <ArmyDetail army={{ ...army, name: army.label, stamina: army.stamina, revealYield }} />
          <TroopOathSlots category={army.troopsFact.category} explorerId={army.explorerId} />
          <ArmyRelicSlots explorerId={army.explorerId} />
        </>
      )}
      {!waiting && deleting && (
        <ArmyDeleteConfirm army={army} onCancel={() => setDeleting(false)} onDeleted={onClose} />
      )}
      {!waiting && spire && <HudWindowFoot>{spire}</HudWindowFoot>}
    </HudSheet>
  );
};
