import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectPreviewBuildingMenu } from "@/ui/components/construction/SelectPreviewBuilding";
import { QuestId } from "@/ui/components/quest/questDetails";
import { StructureConstructionMenu } from "@/ui/components/structures/construction/StructureConstructionMenu";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { AllResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { BaseContainer } from "@/ui/containers/BaseContainer";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Suspense, lazy, useMemo, useState } from "react";
import {
  construction,
  military,
  quests as questsPopup,
  trade,
  worldStructures,
} from "../../components/navigation/Config";
import CircleButton from "../../elements/CircleButton";
import { Chat } from "../chat/Chat";
import { Military } from "../military/Military";
import { WorldStructuresMenu } from "../world-structures/WorldStructuresMenu";
import { MiniMapNavigation } from "./MiniMapNavigation";

const EntityDetails = lazy(() =>
  import("../entity-details/EntityDetails").then((module) => ({ default: module.EntityDetails })),
);

export enum View {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  WorldStructuresView,
  ResourceArrivals,
}

export const LeftNavigationModule = () => {
  const [notificationLength, setNotificationLength] = useState(0);

  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);

  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { toggleModal } = useModalStore();
  const { isMapView } = useQuery();

  const { questClaimStatus } = useQuestClaimStatus();

  const isBuildQuest = useMemo(() => {
    return (
      selectedQuest?.id === QuestId.BuildFood ||
      selectedQuest?.id === QuestId.BuildResource ||
      selectedQuest?.id === QuestId.BuildWorkersHut ||
      selectedQuest?.id === QuestId.Market ||
      (selectedQuest?.id === QuestId.Hyperstructure && isMapView)
    );
  }, [selectedQuest, isMapView]);

  const { getEntityInfo } = getEntitiesUtils();
  const structureInfo = getEntityInfo(structureEntityId);
  const structureIsMine = useMemo(() => structureInfo.isMine, [structureInfo]);

  const isRealm = useMemo(
    () => Boolean(structureInfo) && String(structureInfo?.structureCategory) === "Realm",
    [structureInfo],
  );

  const navigation = useMemo(() => {
    const baseNavigation = [
      {
        name: MenuEnum.entityDetails,
        button: (
          <CircleButton
            image={BuildingThumbs.hex}
            tooltipLocation="top"
            label="Details"
            active={view === View.EntityView}
            size="xl"
            onClick={() => setView(view === View.EntityView ? View.None : View.EntityView)}
          />
        ),
      },
      {
        name: MenuEnum.military,
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              "animate-pulse":
                view !== View.ConstructionView &&
                selectedQuest?.id === QuestId.CreateAttackArmy &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.CreateTrade] && isRealm,
            })}
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === View.MilitaryView}
            size="xl"
            onClick={() => setView(view === View.MilitaryView ? View.None : View.MilitaryView)}
          />
        ),
      },
      {
        name: MenuEnum.construction,
        button: (
          <CircleButton
            disabled={!structureIsMine || !isRealm}
            className={clsx({
              "animate-pulse": view !== View.ConstructionView && isBuildQuest && isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.Settle] && isRealm,
            })}
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === View.ConstructionView}
            size="xl"
            onClick={() => setView(view === View.ConstructionView ? View.None : View.ConstructionView)}
          />
        ),
      },
      {
        name: MenuEnum.resourceArrivals,
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({ hidden: !questClaimStatus[QuestId.CreateTrade] && isRealm })}
            image={BuildingThumbs.trade}
            tooltipLocation="top"
            label="Resource Arrivals"
            active={view === View.ResourceArrivals}
            size="xl"
            onClick={() => setView(view === View.ResourceArrivals ? View.None : View.ResourceArrivals)}
            notification={notificationLength}
            notificationLocation="topleft"
          />
        ),
      },
      {
        name: MenuEnum.worldStructures,
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              hidden: !questClaimStatus[QuestId.CreateAttackArmy] && isRealm,
              "animate-pulse":
                view !== View.ConstructionView &&
                selectedQuest?.id === QuestId.Contribution &&
                isPopupOpen(questsPopup),
            })}
            image={BuildingThumbs.worldStructures}
            tooltipLocation="top"
            label={worldStructures}
            active={view === View.WorldStructuresView}
            size="xl"
            onClick={() => setView(view === View.WorldStructuresView ? View.None : View.WorldStructuresView)}
          />
        ),
      },
      {
        name: MenuEnum.trade,
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              "animate-pulse":
                selectedQuest?.id === QuestId.CreateTrade &&
                selectedQuest.status !== QuestStatus.Completed &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.BuildResource] && isRealm,
            })}
            image={BuildingThumbs.scale}
            tooltipLocation="top"
            label={trade}
            active={isPopupOpen(trade)}
            size="xl"
            onClick={() => toggleModal(isPopupOpen(trade) ? null : <MarketModal />)}
          />
        ),
      },
    ];

    const filteredNavigation = baseNavigation.filter((item) =>
      [
        MenuEnum.entityDetails,
        MenuEnum.military,
        MenuEnum.construction,
        MenuEnum.worldStructures,
        MenuEnum.resourceArrivals,
        MenuEnum.trade,
      ].includes(item.name as MenuEnum),
    );

    return isMapView ? filteredNavigation : filteredNavigation;
  }, [
    view,
    openedPopups,
    selectedQuest,
    questClaimStatus,
    structureEntityId,
    isMapView,
    structureIsMine,
    isRealm,
    notificationLength,
  ]);

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex-grow overflow-hidden">
        <div
          className={`max-h-full transition-all duration-200 space-x-1 flex gap-2 z-0 w-[600px] text-gold left-10 pt-20 pointer-events-none ${
            isOffscreen(view) ? "-translate-x-[88%]" : ""
          }`}
        >
          <BaseContainer className={`w-full pointer-events-auto overflow-y-auto max-h-[60vh]}`}>
            <Suspense fallback={<div>Loading...</div>}>
              {view === View.EntityView && <EntityDetails />}
              {view === View.MilitaryView && <Military entityId={structureEntityId} />}
              {!isMapView && view === View.ConstructionView && (
                <SelectPreviewBuildingMenu entityId={structureEntityId} />
              )}
              {isMapView && view === View.ConstructionView && (
                <StructureConstructionMenu entityId={structureEntityId} />
              )}
              {view === View.WorldStructuresView && <WorldStructuresMenu />}
              {view === View.ResourceArrivals && <AllResourceArrivals setNotificationLength={setNotificationLength} />}
            </Suspense>
          </BaseContainer>
          <motion.div
            variants={slideLeft}
            initial="hidden"
            animate="visible"
            className="flex flex-col justify-center pointer-events-auto"
          >
            <div className="flex flex-col gap-2 mb-auto">
              {navigation.map((item, index) => (
                <div key={index}>{item.button}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      <div className="flex">
        <Chat />
        <MiniMapNavigation />
      </div>
    </div>
  );
};

const isOffscreen = (view: View) => {
  return view === View.None;
};
