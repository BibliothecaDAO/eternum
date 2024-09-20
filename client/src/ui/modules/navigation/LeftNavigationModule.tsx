import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";
import { QuestId } from "@/ui/components/quest/questDetails";
import { StructureConstructionMenu } from "@/ui/components/structures/construction/StructureConstructionMenu";
import { BuildingThumbs } from "@/ui/config";
import { BaseContainer } from "@/ui/containers/BaseContainer";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { construction, military, quests as questsPopup, worldStructures } from "../../components/navigation/Config";
import CircleButton from "../../elements/CircleButton";
import { EntityDetails } from "../entity-details/EntityDetails";
import { Military } from "../military/Military";
import { WorldStructuresMenu } from "../world-structures/WorldStructuresMenu";
import { MenuEnum } from "./BottomNavigation";

export enum View {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  WorldStructuresView,
}

export const LeftNavigationModule = () => {
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { questClaimStatus } = useQuestClaimStatus();

  const { isMapView } = useQuery();

  const isBuildQuest = useMemo(() => {
    return (
      selectedQuest?.id === QuestId.BuildFarm ||
      selectedQuest?.id === QuestId.BuildResource ||
      selectedQuest?.id === QuestId.BuildWorkersHut ||
      selectedQuest?.id === QuestId.Market ||
      (selectedQuest?.id === QuestId.Hyperstructure && isMapView)
    );
  }, [selectedQuest, isMapView]);
  const { getEntityInfo } = getEntitiesUtils();
  const structureInfo = getEntityInfo(structureEntityId);
  const structureIsMine = structureInfo.isMine;

  const isRealm = Boolean(structureInfo) && String(structureInfo?.structureCategory) === "Realm";

  const navigation = useMemo(() => {
    const navigation = [
      {
        name: "entityDetails",
        button: (
          <CircleButton
            image={BuildingThumbs.hex}
            tooltipLocation="top"
            label={"Details"}
            active={view === View.EntityView}
            size="xl"
            onClick={() => {
              if (view === View.EntityView) {
                setView(View.None);
              } else {
                setView(View.EntityView);
              }
            }}
          />
        ),
      },
      {
        name: "military",
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              "animate-pulse":
                view != View.ConstructionView &&
                selectedQuest?.id === QuestId.CreateAttackArmy &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.CreateTrade] && isRealm,
            })}
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === View.MilitaryView}
            size="xl"
            onClick={() => {
              if (view === View.MilitaryView) {
                setView(View.None);
              } else {
                setView(View.MilitaryView);
              }
            }}
          />
        ),
      },
      {
        name: "construction",
        button: (
          <CircleButton
            disabled={!structureIsMine || !isRealm}
            className={clsx({
              "animate-pulse": view != View.ConstructionView && isBuildQuest && isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.Settle] && isRealm,
            })}
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === View.ConstructionView}
            size="xl"
            onClick={() => {
              if (view === View.ConstructionView) {
                setView(View.None);
              } else {
                setView(View.ConstructionView);
              }
            }}
          />
        ),
      },
      {
        name: "worldStructures",
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              hidden: !questClaimStatus[QuestId.CreateAttackArmy] && isRealm,
              "animate-pulse":
                view != View.ConstructionView && selectedQuest?.id === QuestId.Contribution && isPopupOpen(questsPopup),
            })}
            image={BuildingThumbs.worldStructures}
            tooltipLocation="top"
            label={worldStructures}
            active={view === View.WorldStructuresView}
            size="xl"
            onClick={() => {
              if (view === View.WorldStructuresView) {
                setView(View.None);
              } else {
                setView(View.WorldStructuresView);
              }
            }}
          />
        ),
      },
    ];

    return isMapView
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
  }, [location, view, openedPopups, selectedQuest, questClaimStatus, structureEntityId]);

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div
        className={`max-h-full transition-all duration-200 space-x-1 gap-1 flex z-0 w-[600px] text-gold left-10 self-center pointer-events-none ${
          isOffscreen(view) ? "-translate-x-[88%]" : ""
        }`}
      >
        <BaseContainer
          className={`w-full pointer-events-auto overflow-y-auto ${isOffscreen(view) ? "h-[20vh]" : "h-[60vh]"}`}
        >
          {view === View.EntityView && <EntityDetails />}
          {view === View.MilitaryView && <Military entityId={structureEntityId} />}
          {!isMapView && view === View.ConstructionView && <SelectPreviewBuildingMenu />}
          {isMapView && view === View.ConstructionView && <StructureConstructionMenu />}
          {view === View.WorldStructuresView && <WorldStructuresMenu />}
        </BaseContainer>
        <motion.div
          variants={slideLeft}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center pointer-events-auto"
        >
          <div className="flex flex-col gap-2 mb-auto">
            <div className="flex flex-col space-y-2 py-2">
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
