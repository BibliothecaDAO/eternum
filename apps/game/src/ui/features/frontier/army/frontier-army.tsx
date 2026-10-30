import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { toast } from "@/ui/features/event-feed/notify";
import { realmLearned, scoutingKindsOf, heldSkillPoints, type SkillPointChoice } from "@bibliothecadao/eternum";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";

import { useArmyRevealYield } from "../frontier-reveal-yield";
import { SpireButton, useArmyAtItsSpire } from "../spire-card";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { type ArmyDetailFacts, readArmyDetail } from "./army-detail";
import { SCOUTING_CHOICES } from "../progression-choices";
import { ArmyDetail } from "./army-panel";
import { ArmyRefill } from "./army-refill";

const PROGRESS_MODELS = ["RealmKnowledge", "ArmyProgress", "ArmyProgressionRules"] as const;

/**
 * The selected army's detail over the game's facts, the one army panel: opened by selecting the army, on the map or
 * from the dock (its row on a desktop, its token on a phone). None while no army of the realm is selected.
 */
export const FrontierArmy = ({
  realm,
  choosing,
  onClose,
}: {
  realm: NativeRows["Structure"];
  /** Opens on the level-up choices: a phone's Level up beside the picked army. */
  choosing: boolean;
  onClose: () => void;
}) => {
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const army = useDockArmies(realm).find(({ explorerId }) => explorerId === selectedId);
  return army ? (
    <ArmyPanel key={`${army.explorerId}-${choosing}`} realm={realm} army={army} choosing={choosing} onClose={onClose} />
  ) : null;
};

/** One army's panel: Level up buys a level (spend_skill_point), held until its outcome. None while its progress is unknown. */
const ArmyPanel = ({
  realm,
  army,
  choosing,
  onClose,
}: {
  realm: NativeRows["Structure"];
  army: DockArmy;
  choosing: boolean;
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  useNativeRevision(PROGRESS_MODELS);
  const sending = useInFlight("tier", army.explorerId) !== undefined;
  const revealYield = useArmyRevealYield(army);
  const spire = useArmyAtItsSpire(army.explorerId);
  const progress = setup.store.get("ArmyProgress", { game_id: realm.game_id, explorer_id: army.explorerId });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: realm.game_id });
  if (!progress || !rules || !army.stamina) return null;
  const learned = realmLearned(setup.store, realm.game_id, realm.entity_id);
  if (learned === undefined) return null;
  const facts: ArmyDetailFacts = {
    learned,
    name: army.label,
    art: army.art,
    troops: army.troops,
    xp: progress.xp,
    stamina: army.stamina,
    secondsToFull: army.secondsToFull,
    revealYield,
    progress: {
      battle: progress.battle,
      logistics: progress.logistics,
      scouting: progress.scouting,
      homecoming: progress.homecoming,
      scoutingKinds: scoutingKindsOf(progress.scouting, progress.scouting_kinds).map(
        (kind) => SCOUTING_CHOICES[kind].key,
      ),
    },
    points: heldSkillPoints(progress),
    rules,
  };

  const levelUp = async (choice: SkillPointChoice) => {
    const signer = account.account;
    if (!signer) return;
    try {
      await sendOnce("tier", army.explorerId, true, () =>
        setup.systemCalls.spend_skill_point({
          signer,
          explorerId: army.explorerId,
          choice,
        }),
      );
    } catch (error) {
      toast.failed(error, "The level-up could not be sent.");
    }
  };

  return (
    <HudSheet label={army.label} onClose={onClose}>
      <ArmyDetail
        army={readArmyDetail(facts)}
        refill={<ArmyRefill army={army} realm={realm} look="chip" />}
        sending={sending}
        choosing={choosing}
        onLevelUp={levelUp}
      />
      {spire && (
        <HudWindowFoot>
          <SpireButton explorerId={army.explorerId} spire={spire} />
        </HudWindowFoot>
      )}
    </HudSheet>
  );
};
