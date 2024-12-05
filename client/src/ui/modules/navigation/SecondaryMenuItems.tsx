import { useAccountStore } from "@/hooks/context/accountStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useTutorial } from "@/hooks/use-tutorial";
import { rewards, settings } from "@/ui/components/navigation/Config";
import { QuestId } from "@/ui/components/quest/questDetails";
import { questSteps } from "@/ui/components/quest/QuestList";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { isRealmSelected } from "@/ui/utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { useCallback, useMemo } from "react";
import { quests as questsWindow, social } from "../../components/navigation/Config";
import { Rewards } from "../rewards/Rewards";

export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: {
        events: { GameEnded },
      },
    },
  } = useDojo();

  const { toggleModal } = useModalStore();
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const { connector } = useAccountStore();

  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { quests } = useQuests();

  const { unclaimedQuestsCount } = useUnclaimedQuestsCount();

  const { playerStructures } = useEntities();
  const structures = playerStructures();

  const completedQuests = quests?.filter((quest: any) => quest.status === QuestStatus.Claimed);

  const currentQuest = quests?.find(
    (quest: any) => quest.status === QuestStatus.InProgress || quest.status === QuestStatus.Completed,
  );

  const { handleStart } = useTutorial(questSteps.get(currentQuest?.id || QuestId.Settle));
  const gameEnded = useEntityQuery([Has(GameEnded)]);

  const realmSelected = useMemo(() => {
    return isRealmSelected(structureEntityId, structures) ? true : false;
  }, [structureEntityId, structures]);

  const handleTrophyClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");
      return;
    }
    connector.controller.openProfile("trophies");
  }, [connector]);

  const secondaryNavigation = useMemo(() => {
    const buttons = [
      {
        button: (
          <div className="flex items-center gap-2 bg-brown/90 border border-gold/30 rounded-full px-4 h-10 md:h-12">
            <button
              className="claim-selector text-gold hover:text-gold/80 text-sm font-semibold"
              onClick={() => {
                /* Claim logic */
              }}
            >
              Claim
            </button>

            <div className="h-6 w-px bg-gold/30 mx-2" />

            <button onClick={() => togglePopup(questsWindow)} className="text-gold text-sm">
              {/* <span className="font-semibold">Current Quest</span> */}
              <span className="font-semibold">{currentQuest?.name}</span>
              {/* <span className="text-xs ml-2">({unclaimedQuestsCount} remaining)</span> */}
            </button>

            <div className="h-6 w-px bg-gold/30 mx-2" />

            <button
              className="tutorial-selector animate-pulse text-gold hover:text-gold/80 text-sm font-semibold"
              onClick={() => {
                handleStart();
              }}
            >
              Tutorial
            </button>
          </div>
        ),
      },
      // {
      //   button: (
      //     <div className="relative">
      //       <CircleButton
      //         className="quest-selector"
      //         tooltipLocation="bottom"
      //         image={BuildingThumbs.squire}
      //         label={questsWindow}
      //         active={isPopupOpen(questsWindow)}
      //         size="lg"
      //         onClick={() => togglePopup(questsWindow)}
      //         notification={realmSelected ? unclaimedQuestsCount : undefined}
      //         notificationLocation={"bottomleft"}
      //         disabled={!realmSelected}
      //       />
      //     </div>
      //   ),
      // },
      {
        button: (
          <CircleButton
            className="social-selector"
            tooltipLocation="bottom"
            image={BuildingThumbs.guild}
            label={social}
            active={isPopupOpen(social)}
            size="lg"
            onClick={() => togglePopup(social)}
          />
        ),
      },
    ];
    if (gameEnded.length !== 0) {
      buttons.push({
        button: (
          <CircleButton
            tooltipLocation="bottom"
            image={BuildingThumbs.rewards}
            label={rewards}
            active={isPopupOpen(rewards)}
            size="lg"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [unclaimedQuestsCount, quests, structureEntityId, gameEnded]);

  return (
    <div className="flex gap-1 md:gap-3">
      <div className="top-right-navigation-selector self-center px-1 md:px-3 flex space-x-1 md:space-x-2 my-1">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          className="trophies-selector"
          image={BuildingThumbs.trophy}
          label={"Trophies"}
          // active={isPopupOpen(quests)}
          size="lg"
          onClick={handleTrophyClick}
        />
        <CircleButton
          className="hints-selector"
          image={BuildingThumbs.question}
          label={"Rewards"}
          size="lg"
          onClick={() => toggleModal(<Rewards />)}
        />
        <CircleButton
          className="discord-selector"
          tooltipLocation="bottom"
          image={BuildingThumbs.discord}
          label={"Discord"}
          size="lg"
          onClick={() => window.open("https://discord.gg/realmsworld")}
        />
        <CircleButton
          className="settings-selector"
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Support"}
          size="lg"
          onClick={() => togglePopup(settings)}
        />
      </div>
    </div>
  );
};
