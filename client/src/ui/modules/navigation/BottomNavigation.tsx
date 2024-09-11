import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuestClaimStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { QuestId } from "@/ui/components/quest/questDetails";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { isRealmSelected } from "@/ui/utils/utils";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { guilds, leaderboard, quests as questsWindow } from "../../components/navigation/Config";
import { Assistant } from "../assistant/Assistant";
import { Guilds } from "../guilds/Guilds";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { Questing } from "../questing/Questing";

export enum MenuEnum {
  military = "military",
  construction = "construction",
  worldStructures = "worldStructures",
  entityDetails = "entityDetails",
}

export const BottomNavigation = () => {
  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { quests } = useQuests();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();
  const { questClaimStatus } = useQuestClaimStatus();

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { playerStructures } = useEntities();
  const structures = useMemo(() => playerStructures(), [playerStructures]);

  const questToClaim = quests?.find((quest: any) => quest.status === QuestStatus.Completed);

  const realmSelected = useMemo(() => {
    return isRealmSelected(structureEntityId, structures) ? true : false;
  }, [structureEntityId, structures]);

  const secondaryNavigation = useMemo(() => {
    return [
      {
        button: (
          <div className="relative">
            <CircleButton
              tooltipLocation="top"
              image={BuildingThumbs.squire}
              label={questsWindow}
              active={isPopupOpen(questsWindow)}
              size="lg"
              onClick={() => togglePopup(questsWindow)}
              notification={realmSelected ? unclaimedQuestsCount : undefined}
              notificationLocation={"topleft"}
              disabled={!realmSelected}
            />

            {questToClaim && !isMapView && realmSelected && (
              <div className="absolute bg-black/90 text-gold border-gradient border -top-12 w-32 animate-bounce px-1 py-1 flex uppercase">
                <ArrowDown className="text-gold w-4 mr-3" />
                <div className="text-xs">Claim your reward</div>
              </div>
            )}
          </div>
        ),
      },
      {
        button: (
          <CircleButton
            tooltipLocation="top"
            image={BuildingThumbs.leaderboard}
            label={leaderboard}
            active={isPopupOpen(leaderboard)}
            size="lg"
            onClick={() => togglePopup(leaderboard)}
            className={clsx({ hidden: !questClaimStatus[QuestId.Travel] })}
          />
        ),
      },
      {
        button: (
          <CircleButton
            tooltipLocation="top"
            image={BuildingThumbs.guild}
            label={guilds}
            active={isPopupOpen(guilds)}
            size="lg"
            onClick={() => togglePopup(guilds)}
            className={clsx({
              hidden: !questClaimStatus[QuestId.Travel],
            })}
          />
        ),
      },
    ];
  }, [unclaimedQuestsCount, selectedQuest, quests, structureEntityId]);

  const slideUp = {
    hidden: { y: "100%", transition: { duration: 0.3 } },
    visible: { y: "0%", transition: { duration: 0.3 } },
  };

  return (
    <>
      <div className="pointer-events-auto">
        <Questing entityId={structureEntityId} />
        <Assistant />
        <Leaderboard />
        <Guilds />
      </div>

      <motion.div
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="flex justify-center flex-wrap relative w-full duration-300 transition-all"
      >
        <div className="">
          <div className="flex py-2 px-10 gap-1 pointer-events-auto">
            {secondaryNavigation.map((a, index) => (
              <div key={index}>{a.button}</div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
};
