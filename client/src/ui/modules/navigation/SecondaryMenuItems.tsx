import { useAccountStore } from "@/hooks/context/accountStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuests, useUnclaimedQuestsCount } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { HintModal } from "@/ui/components/hints/HintModal";
import { rewards, settings } from "@/ui/components/navigation/Config";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { isRealmSelected } from "@/ui/utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import { ArrowUp } from "lucide-react";
import { useCallback, useMemo } from "react";
import { quests as questsWindow, social } from "../../components/navigation/Config";
import { Controller } from "../controller/Controller";

export const SecondaryMenuItems = () => {
  const {
    account: { account },
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

  const gameEnded = useEntityQuery([Has(GameEnded)]);

  const realmSelected = useMemo(() => {
    return isRealmSelected(structureEntityId, structures) ? true : false;
  }, [structureEntityId, structures]);

  const handleTrophyClick = useCallback(() => {
    connector?.controller?.openProfile("trophies");
  }, [connector]);

  const secondaryNavigation = useMemo(() => {
    const buttons = [
      {
        button: (
          <div className="relative">
            <CircleButton
              tooltipLocation="bottom"
              image={BuildingThumbs.squire}
              label={questsWindow}
              active={isPopupOpen(questsWindow)}
              size="sm"
              className="border-none"
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
            image={BuildingThumbs.guild}
            label={social}
            active={isPopupOpen(social)}
            size="sm"
            className="border-none"
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
            size="sm"
            className="border-none"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [unclaimedQuestsCount, quests, structureEntityId, gameEnded]);

  return (
    <div className="flex gap-1 md:gap-4">
      <div className="self-center px-1 md:px-3 flex space-x-4 md:space-x-4 my-4">
        {secondaryNavigation.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        <CircleButton
          className="border-none"
          image={BuildingThumbs.trophy}
          label={"Trophies"}
          size="sm"
          onClick={handleTrophyClick}
        />
        <CircleButton
          image={BuildingThumbs.question}
          label={"Hints"}
          size="sm"
          className="border-none"
          onClick={() => toggleModal(<HintModal />)}
        />
        <CircleButton
          tooltipLocation="bottom"
          image={BuildingThumbs.discord}
          label={"Discord"}
          size="sm"
          className="border-none"
          onClick={() => window.open("https://discord.gg/realmsworld")}
        />
        <CircleButton
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Support"}
          size="sm"
          className="border-none"
          onClick={() => togglePopup(settings)}
        />
        <Controller />
      </div>
    </div>
  );
};
