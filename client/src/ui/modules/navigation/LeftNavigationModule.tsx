import { useEntityArmies } from "@/hooks/helpers/useArmies";
import { useStamina } from "@/hooks/helpers/useStamina";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";
import { StructureConstructionMenu } from "@/ui/components/structures/construction/StructureConstructionMenu";
import { BaseContainer } from "@/ui/containers/BaseContainer";
import Button from "@/ui/elements/Button";
import { EntityDetails } from "@/ui/modules/entity-details/EntityDetails";
import { Military } from "@/ui/modules/military/Military";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { debounce } from "lodash";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { construction, military, worldStructures } from "../../components/navigation/Config";
import CircleButton from "../../elements/CircleButton";
import { Assistant } from "../assistant/Assistant";
import { Banks } from "../banking/Banks";
import { Guilds } from "../guilds/Guilds";
import { Leaderboard } from "../leaderboard/LeaderBoard";
import { Questing } from "../questing/Questing";
import { SettingsWindow } from "../settings/Settings";
import { WorldStructuresMenu } from "../world-structures/WorldStructuresMenu";
import { MenuEnum } from "./BottomNavigation";

export const BuildingThumbs = {
  hex: "/images/buildings/thumb/question.png",
  military: "/images/buildings/thumb/sword.png",
  construction: "/images/buildings/thumb/crane.png",
  trade: "/images/buildings/thumb/trade.png",
  resources: "/images/buildings/thumb/resources.png",
  banks: "/images/buildings/thumb/banks.png",
  worldStructures: "/images/buildings/thumb/world-map.png",
  leaderboard: "/images/buildings/thumb/leaderboard.png",
  worldMap: "/images/buildings/thumb/world-map.png",
  squire: "/images/buildings/thumb/squire.png",
  question: "/images/buildings/thumb/question-wood.png",
  scale: "/images/buildings/thumb/scale.png",
  settings: "/images/buildings/thumb/settings.png",
  guild: "/images/buildings/thumb/guilds.png",
};

export enum View {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  StructureView,
  WorldStructuresView,
}

export const LeftNavigationModule = () => {
  const [lastView, setLastView] = useState<View>(View.None);

  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);

  const { realmEntityId } = useRealmStore();
  const { getStamina } = useStamina();
  const { entityArmies } = useEntityArmies({ entity_id: realmEntityId });

  const [location, setLocation] = useLocation();

  const isWorldView = useMemo(() => location === "/map", [location]);

  const armiesWithStaminaLeft = entityArmies?.filter((entity) => {
    return (
      getStamina({ travelingEntityId: BigInt(entity.entity_id) })?.amount >= EternumGlobalConfig.stamina.travelCost
    );
  });

  const navigation = useMemo(() => {
    const navigation = [
      {
        name: "entityDetails",
        button: (
          <CircleButton
            className="construction-selector"
            image={BuildingThumbs.hex}
            tooltipLocation="top"
            label={"Details"}
            active={view === View.EntityView}
            size="xl"
            onClick={() => {
              setLastView(View.EntityView);
              setView(View.EntityView);
            }}
          />
        ),
      },
      {
        name: "military",
        button: (
          <CircleButton
            className="military-selector"
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === View.MilitaryView}
            size="xl"
            onClick={() => {
              setLastView(View.MilitaryView);
              setView(View.MilitaryView);
            }}
            notification={armiesWithStaminaLeft.length}
            notificationLocation="topright"
          />
        ),
      },
      {
        name: "construction",
        button: (
          <CircleButton
            className="construction-selector"
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === View.ConstructionView}
            size="xl"
            onClick={() => {
              setLastView(View.ConstructionView);
              setView(View.ConstructionView);
            }}
          />
        ),
      },
      {
        name: "worldStructures",
        button: (
          <CircleButton
            className="worldStructures-selector"
            image={BuildingThumbs.worldStructures}
            tooltipLocation="top"
            label={worldStructures}
            active={view === View.WorldStructuresView}
            size="xl"
            onClick={() => {
              setLastView(View.WorldStructuresView);
              setView(View.WorldStructuresView);
            }}
          />
        ),
      },
    ];

    return isWorldView
      ? navigation.filter(
          (item) =>
            item.name === MenuEnum.entityDetails ||
            item.name === MenuEnum.military ||
            item.name === MenuEnum.construction ||
            item.name === MenuEnum.worldStructures,
        )
      : navigation.filter(
          (item) =>
            item.name === MenuEnum.entityDetails ||
            item.name === MenuEnum.military ||
            item.name === MenuEnum.construction ||
            item.name === MenuEnum.worldStructures,
        );
  }, [location, view, armiesWithStaminaLeft]);

  if (realmEntityId === undefined) {
    return null;
  }

  // Making UX smoother by not closing the menu immediatly. The cursor often moves a little further than the menu edge
  const debouncedSetIsOffscreen = debounce(() => {
    setView(View.None);
  }, 1500);

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div className="pointer-events-auto">
        <SettingsWindow />
        <Questing entityId={realmEntityId} />
        <Assistant />
        <Leaderboard />
        <Banks />
        <Guilds />
      </div>

      <div
        className={`max-h-full transition-all duration-200 space-x-1 gap-1  flex z-0 w-[600px] text-gold left-10 self-center pointer-events-auto ${
          isOffscreen(view) ? "-translate-x-[86%] " : ""
        }`}
        onPointerEnter={() => {
          debouncedSetIsOffscreen.cancel();
          if (view === View.None && lastView === View.None) {
            const newView = View.ConstructionView;
            setView(newView);
            setLastView(newView);
          } else if (view === View.None) {
            setView(lastView);
          } else {
            setLastView(view);
          }
        }}
        onPointerLeave={debouncedSetIsOffscreen}
      >
        <BaseContainer className={`w-full overflow-y-scroll ${isOffscreen(view) ? "h-[20vh]" : "h-[60vh]"}`}>
          {view === View.EntityView && <EntityDetails />}
          {view === View.MilitaryView && <Military entityId={realmEntityId} />}
          {!isWorldView && view === View.ConstructionView && <SelectPreviewBuildingMenu />}
          {isWorldView && view === View.ConstructionView && <StructureConstructionMenu />}
          {view === View.WorldStructuresView && <WorldStructuresMenu />}
        </BaseContainer>
        <motion.div
          variants={slideLeft}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center"
        >
          <div>
            <Button onClick={() => setView(isOffscreen(view) ? lastView : View.None)} variant="primary">
              <ArrowRight className={`w-4 h-4 duration-200 ${isOffscreen(view) ? "" : "rotate-180"}`} />
            </Button>
          </div>
          <div className="flex flex-col gap-2 mb-auto">
            <div className="flex flex-col space-y-2 py-2 sixth-step">
              {navigation.map((a, index) => (
                <div key={index}>{a.button}</div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

const isOffscreen = (view: View) => {
  return view === View.None;
};
