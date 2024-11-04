import { useQuery } from "@/hooks/helpers/useQuery";
import { QuestStatus, useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useModalStore } from "@/hooks/store/useModalStore";
import { useQuestStore } from "@/hooks/store/useQuestStore";
import useUIStore from "@/hooks/store/useUIStore";

import { QuestId } from "@/ui/components/quest/questDetails";

import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { BuildingThumbs, IS_MOBILE, MenuEnum } from "@/ui/config";
import { BaseContainer } from "@/ui/containers/BaseContainer";
import { KeyBoardKey } from "@/ui/elements/KeyBoardKey";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  construction,
  military,
  quests as questsPopup,
  trade,
  worldStructures,
} from "../../components/navigation/Config";
import CircleButton from "../../elements/CircleButton";
// import { Chat } from "../chat/Chat";
import { MiniMapNavigation } from "./MiniMapNavigation";

const EntityDetails = lazy(() =>
  import("../entity-details/EntityDetails").then((module) => ({ default: module.EntityDetails })),
);
const Military = lazy(() => import("../military/Military").then((module) => ({ default: module.Military })));
const SelectPreviewBuildingMenu = lazy(() =>
  import("../../components/construction/SelectPreviewBuilding").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);
const StructureConstructionMenu = lazy(() =>
  import("../../components/structures/construction/StructureConstructionMenu").then((module) => ({
    default: module.StructureConstructionMenu,
  })),
);
const WorldStructuresMenu = lazy(() =>
  import("../world-structures/WorldStructuresMenu").then((module) => ({ default: module.WorldStructuresMenu })),
);

const AllResourceArrivals = lazy(() =>
  import("../../components/trading/ResourceArrivals").then((module) => ({ default: module.AllResourceArrivals })),
);

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  WorldStructuresView,
  ResourceArrivals,
  ResourceTable,
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

  const { getEntityInfo } = useEntitiesUtils();

  const structureInfo = getEntityInfo(structureEntityId);
  const structureIsMine = useMemo(() => structureInfo.isMine, [structureInfo]);

  const isRealm = useMemo(
    () => Boolean(structureInfo) && String(structureInfo?.structureCategory) === "Realm",
    [structureInfo],
  );

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case "e":
          setView(view === LeftView.EntityView ? LeftView.None : LeftView.EntityView);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [view, setView, toggleModal]);

  const navigation = useMemo(() => {
    const baseNavigation = [
      {
        name: MenuEnum.entityDetails,
        button: (
          <div className="relative">
            <CircleButton
              image={BuildingThumbs.hex}
              tooltipLocation="top"
              label="Details"
              active={view === LeftView.EntityView}
              size={IS_MOBILE ? "lg" : "xl"}
              onClick={() => setView(view === LeftView.EntityView ? LeftView.None : LeftView.EntityView)}
            />
            {!IS_MOBILE && (
              <KeyBoardKey invertColors={view === LeftView.EntityView} className="absolute top-1 right-1" keyName="E" />
            )}
          </div>
        ),
      },
      {
        name: MenuEnum.military,
        button: (
          <CircleButton
            disabled={!structureIsMine}
            className={clsx({
              "animate-pulse":
                view !== LeftView.ConstructionView &&
                selectedQuest?.id === QuestId.CreateAttackArmy &&
                isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.CreateTrade] && isRealm,
            })}
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === LeftView.MilitaryView}
            size={IS_MOBILE ? "lg" : "xl"}
            onClick={() => setView(view === LeftView.MilitaryView ? LeftView.None : LeftView.MilitaryView)}
          />
        ),
      },
      {
        name: MenuEnum.construction,
        button: (
          <CircleButton
            disabled={!structureIsMine || !isRealm}
            className={clsx({
              "animate-pulse": view !== LeftView.ConstructionView && isBuildQuest && isPopupOpen(questsPopup),
              hidden: !questClaimStatus[QuestId.Settle] && isRealm,
            })}
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === LeftView.ConstructionView}
            size={IS_MOBILE ? "lg" : "xl"}
            onClick={() => setView(view === LeftView.ConstructionView ? LeftView.None : LeftView.ConstructionView)}
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
            active={view === LeftView.ResourceArrivals}
            size={IS_MOBILE ? "lg" : "xl"}
            onClick={() => setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals)}
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
                view !== LeftView.ConstructionView &&
                selectedQuest?.id === QuestId.Contribution &&
                isPopupOpen(questsPopup),
            })}
            image={BuildingThumbs.worldStructures}
            tooltipLocation="top"
            label={worldStructures}
            active={view === LeftView.WorldStructuresView}
            size={IS_MOBILE ? "lg" : "xl"}
            onClick={() =>
              setView(view === LeftView.WorldStructuresView ? LeftView.None : LeftView.WorldStructuresView)
            }
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
            size={IS_MOBILE ? "lg" : "xl"}
            onClick={() => toggleModal(isPopupOpen(trade) ? null : <MarketModal />)}
          />
        ),
      },
      {
        name: MenuEnum.resourceTable,
        button: (
          <CircleButton
            image={BuildingThumbs.resources}
            size={IS_MOBILE ? "lg" : "xl"}
            tooltipLocation="top"
            label="Balance"
            active={view === LeftView.ResourceTable}
            onClick={() => setView(view === LeftView.ResourceTable ? LeftView.None : LeftView.ResourceTable)}
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
        ...(IS_MOBILE ? [MenuEnum.resourceTable] : []),
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
    <div className="flex flex-col">
      <div className="flex-grow overflow-hidden">
        <div
          className={`max-h-full transition-all duration-200 space-x-1 flex gap-2 z-0 w-screen pr-2 md:pr-0 md:w-[600px] text-gold left-10 md:pt-20 pointer-events-none ${
            isOffscreen(view) ? (IS_MOBILE ? "-translate-x-[92%]" : "-translate-x-[88%]") : ""
          }`}
        >
          <BaseContainer
            className={`w-full pointer-events-auto overflow-y-auto max-h-[60vh] md:max-h-[60vh] sm:max-h-[80vh] xs:max-h-[90vh]`}
          >
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              {view === LeftView.EntityView && <EntityDetails />}
              {view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
              {!isMapView && view === LeftView.ConstructionView && (
                <SelectPreviewBuildingMenu entityId={structureEntityId} />
              )}
              {isMapView && view === LeftView.ConstructionView && (
                <StructureConstructionMenu entityId={structureEntityId} />
              )}
              {view === LeftView.WorldStructuresView && <WorldStructuresMenu />}
              {view === LeftView.ResourceArrivals && (
                <AllResourceArrivals setNotificationLength={setNotificationLength} />
              )}
              {view === LeftView.ResourceTable && <EntityResourceTable entityId={structureEntityId} />}
            </Suspense>
          </BaseContainer>
          <motion.div
            variants={slideLeft}
            initial="hidden"
            animate="visible"
            className="flex flex-col justify-center pointer-events-auto"
          >
            <div className="flex flex-col gap-1 md:gap-2 mb-auto">
              {navigation.map((item, index) => (
                <div key={index}>{item.button}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      {!IS_MOBILE && (
        <div className="flex">
          {/* <Chat /> */}
          <MiniMapNavigation />
        </div>
      )}
    </div>
  );
};

const isOffscreen = (view: LeftView) => {
  return view === LeftView.None;
};
