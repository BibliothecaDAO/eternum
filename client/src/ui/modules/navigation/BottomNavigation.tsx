import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import CircleButton from "@/ui/elements/CircleButton";
import { isRealmSelected } from "@/ui/utils/utils";
import clsx from "clsx";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { guilds, leaderboard, quests } from "../../components/navigation/Config";
import { BuildingThumbs } from "./LeftNavigationModule";

export enum MenuEnum {
  realm = "realm",
  worldMap = "world-map",
  military = "military",
  construction = "construction",
  trade = "trade",
  resources = "resources",
  bank = "bank",
  worldStructures = "worldStructures",
  structures = "structures",
  leaderboard = "leaderboard",
  entityDetails = "entityDetails",
}

export const BottomNavigation = () => {
  const [location, setLocation] = useLocation();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityId } = useRealmStore();
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const toggleShowAllArmies = useUIStore((state) => state.toggleShowAllArmies);
  const showAllArmies = useUIStore((state) => state.showAllArmies);

  const isWorldView = useMemo(() => location === "/map", [location]);

  const currentQuest = useQuestStore((state) => state.currentQuest);
  const claimableQuestsLength = useQuestStore((state) => state.claimableQuestsLength);

  const { playerStructures } = useEntities();
  const structures = useMemo(() => playerStructures(), [playerStructures]);

  const secondaryNavigation = useMemo(() => {
    return [
      {
        button: (
          <div className="relative">
            <CircleButton
              tooltipLocation="top"
              image={BuildingThumbs.squire}
              label={quests}
              active={isPopupOpen(quests)}
              size="lg"
              onClick={() => togglePopup(quests)}
              notification={isRealmSelected(realmEntityId, structures) ? claimableQuestsLength : undefined}
              notificationLocation={"topleft"}
              disabled={!isRealmSelected(realmEntityId, structures)}
            />

            {currentQuest?.completed && !currentQuest?.claimed && location !== "/map" && (
              <div className="absolute bg-brown text-gold border-gradient border -top-12 w-32 animate-bounce px-1 py-1 flex uppercase">
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
            className={clsx({ hidden: claimableQuestsLength > 0 })}
          />
        ),
      },
      {
        button: (
          <CircleButton
            tooltipLocation="top"
            image={BuildingThumbs.military}
            label={""}
            active={showAllArmies}
            size="lg"
            onClick={toggleShowAllArmies}
            className={clsx({ hidden: !isWorldView })}
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
            className={clsx({ hidden: claimableQuestsLength > 0 })}
          />
        ),
      },
    ];
  }, [claimableQuestsLength, currentQuest]);

  const slideUp = {
    hidden: { y: "100%", transition: { duration: 0.3 } },
    visible: { y: "0%", transition: { duration: 0.3 } },
  };

  if (!nextBlockTimestamp) {
    return null;
  }

  return (
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
  );
};
