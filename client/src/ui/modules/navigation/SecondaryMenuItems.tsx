import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { HintModal } from "@/ui/components/hints/HintModal";
import { settings } from "@/ui/components/navigation/Config";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { SettingsWindow } from "../settings/Settings";

import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuestClaimStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";

import { QuestId } from "@/ui/components/quest/questDetails";

import { isRealmSelected } from "@/ui/utils/utils";
import clsx from "clsx";

import { ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { leaderboard, quests as questsWindow, social } from "../../components/navigation/Config";

export const SecondaryMenuItems = () => {
  const { toggleModal } = useModalStore();
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);

  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { quests } = useQuests();
  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();
  const { questClaimStatus } = useQuestClaimStatus();

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const completedQuests = quests?.filter((quest: any) => quest.status === QuestStatus.Claimed);

  const realmSelected = useMemo(() => {
    return isRealmSelected(structureEntityId, structures) ? true : false;
  }, [structureEntityId, structures]);

  const secondaryNavigation = useMemo(() => {
    return [
      {
        button: (
          <div className="relative">
            <CircleButton
              tooltipLocation="bottom"
              image={BuildingThumbs.squire}
              label={questsWindow}
              active={isPopupOpen(questsWindow)}
              size="lg"
              onClick={() => togglePopup(questsWindow)}
              notification={realmSelected ? unclaimedQuestsCount : undefined}
              notificationLocation={"bottomleft"}
              disabled={!realmSelected}
            />

            {completedQuests.length < 8 && !isMapView && realmSelected && (
              <div className="absolute bg-brown/90 text-gold border border-gold/30 mt-3 rounded-md shadow-lg left-1/2 transform -translate-x-1/2 w-48 p-3 flex flex-col items-center animate-pulse">
                <ArrowUp className="text-gold w-5 h-5 mb-2" />
                <div className="text-sm font-semibold mb-2 text-center leading-tight">
                  Complete quests to master the game mechanics
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        button: (
          <CircleButton
            tooltipLocation="bottom"
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
            tooltipLocation="bottom"
            image={BuildingThumbs.guild}
            label={social}
            active={isPopupOpen(social)}
            size="lg"
            onClick={() => togglePopup(social)}
            className={clsx({
              hidden: !questClaimStatus[QuestId.Travel],
            })}
          />
        ),
      },
    ];
  }, [unclaimedQuestsCount, selectedQuest, quests, structureEntityId]);
  return (
    <div className="flex gap-1 md:gap-3">
      <div className="self-center px-1 md:px-3 flex space-x-1 md:space-x-2 mr-2 my-1">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          image={BuildingThumbs.question}
          label={"Hints"}
          // active={isPopupOpen(quests)}
          size="lg"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Settings"}
          size="lg"
          onClick={() => togglePopup(settings)}
        />
      </div>
      <SettingsWindow />
    </div>
  );
};
