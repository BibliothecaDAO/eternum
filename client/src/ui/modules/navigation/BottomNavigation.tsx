import { useDojo } from "@/hooks/context/DojoContext";
import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuests } from "@/hooks/helpers/useQuests";
import { useStamina } from "@/hooks/helpers/useStamina";
import useRealmStore from "@/hooks/store/useRealmStore";
import useUIStore from "@/hooks/store/useUIStore";
import { TroopMenuRow } from "@/ui/components/military/TroopChip";
import CircleButton from "@/ui/elements/CircleButton";
import { getEntityIdFromKeys, isRealmSelected } from "@/ui/utils/utils";
import { useComponentValue } from "@dojoengine/react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { guilds, leaderboard, quests } from "../../components/navigation/Config";
import { BuildingThumbs } from "./LeftNavigationModule";
import clsx from "clsx";

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
  const {
    setup: {
      components: { Population },
    },
  } = useDojo();

  const [location, setLocation] = useLocation();
  const { getMaxStaminaByEntityId } = useStamina();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityId } = useRealmStore();
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const toggleShowAllArmies = useUIStore((state) => state.toggleShowAllArmies);
  const showAllArmies = useUIStore((state) => state.showAllArmies);

  const isWorldView = useMemo(() => location === "/map", [location]);

  const selectedEntityId = useUIStore((state) => state.selectedEntity);

  const army = getArmyByEntityId(selectedEntityId?.id || BigInt("0"));

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realmEntityId || "0")]));

  const { claimableQuests, currentQuest } = useQuests({ entityId: realmEntityId || BigInt("0") });

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
              className="forth-step"
              notification={isRealmSelected(realmEntityId, structures) ? claimableQuests?.length : undefined}
              notificationLocation={"topleft"}
              disabled={!isRealmSelected(realmEntityId, structures)}
            />

            {population?.population == null && location !== "/map" && (
              <div className="absolute bg-brown text-gold border-gradient border -top-12 w-32 animate-bounce px-1 py-1 flex uppercase">
                <ArrowDown className="text-gold w-4 mr-3" />
                <div>Start here</div>
              </div>
            )}

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
            className={clsx({ hidden: claimableQuests?.length > 0 })}
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
            className={clsx({ hidden: claimableQuests?.length > 0 })}
          />
        ),
      },
    ];
  }, [claimableQuests]);

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
      className="flex justify-center flex-wrap first-step relative w-full duration-300 transition-all "
    >
      <div className="">
        {selectedEntityId && army && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            className="bg-brown h-32 flex gap-4 text-gold p-3 ornate-borders-sm w-auto clip-angled-sm"
          >
            <div className="flex">
              <img src="./images/avatars/1.png" className="w-24 h-24" alt="" />
              <ProgressBar
                fillColor="yellow"
                totalValue={getMaxStaminaByEntityId(selectedEntityId.id)}
                entityId={selectedEntityId.id}
              />
              <ProgressBar fillColor="green" totalValue={Number(army?.lifetime)} filledValue={Number(army?.current)} />
            </div>
            <div>
              <div className="text-xl">{army.name}</div>
              <TroopMenuRow army={army} />
            </div>
          </motion.div>
        )}

        <div className="flex py-2 sixth-step  px-10 gap-1">
          {secondaryNavigation.map((a, index) => (
            <div key={index}>{a.button}</div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

interface ProgressBarProps {
  fillColor: string;
  totalValue: number;
  entityId?: bigint;
  filledValue?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ fillColor, totalValue, entityId, filledValue }) => {
  const { useStaminaByEntityId } = useStamina();
  const stamina = useStaminaByEntityId({ travelingEntityId: entityId || 0n });

  const filledPercentage = ((stamina?.amount || filledValue || 0) / totalValue) * 100;

  return (
    <div className="relative h-24 w-2 bg-gray-300">
      <div
        className="absolute bottom-0 w-full"
        style={{ height: `${filledPercentage}%`, backgroundColor: fillColor }}
      ></div>
    </div>
  );
};
