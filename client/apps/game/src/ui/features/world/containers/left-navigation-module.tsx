import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { MarketModal } from "@/ui/features/economy/trading/market-modal";
import { AllResourceArrivals } from "@/ui/features/economy/trading/resource-arrivals";
import ChatModule from "@/ui/features/social/chat/chat";
import { construction, military, trade, worldStructures } from "@/ui/features/world";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { motion } from "framer-motion";
import { lazy, memo, Suspense, useEffect, useMemo } from "react";

const EntityDetails = lazy(() =>
  import("@/ui/modules/entity-details/entity-details").then((module) => ({ default: module.EntityDetails })),
);
const Military = lazy(() => import("@/ui/features/military/military").then((module) => ({ default: module.Military })));
const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement/construction/select-preview-building").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);
const WorldStructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.WorldStructuresMenu,
  })),
);

export const LeftNavigationModule = memo(() => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);

  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);

  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const openedPopups = useUIStore((state) => state.openedPopups);

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const toggleModal = useUIStore((state) => state.toggleModal);
  const { isMapView } = useQuery();

  const structureInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), components),
    [structureEntityId, account.address, components],
  );

  const isRealmOrVillage = useMemo(
    () =>
      Boolean(structureInfo) &&
      (structureInfo?.structureCategory === StructureType.Realm ||
        structureInfo?.structureCategory === StructureType.Village),
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
              className="entity-details-selector"
              image={BuildingThumbs.hex}
              tooltipLocation="top"
              label="Details"
              active={view === LeftView.EntityView}
              size={"xl"}
              onClick={() => setView(view === LeftView.EntityView ? LeftView.None : LeftView.EntityView)}
            />
          </div>
        ),
      },
      {
        name: MenuEnum.military,
        button: (
          <CircleButton
            disabled={disableButtons}
            className="military-selector"
            image={BuildingThumbs.military}
            tooltipLocation="top"
            label={military}
            active={view === LeftView.MilitaryView}
            size={"xl"}
            onClick={() => setView(view === LeftView.MilitaryView ? LeftView.None : LeftView.MilitaryView)}
          />
        ),
      },
      {
        name: MenuEnum.construction,
        button: (
          <CircleButton
            disabled={disableButtons || !isRealmOrVillage || isMapView}
            className="construction-selector"
            image={BuildingThumbs.construction}
            tooltipLocation="top"
            label={construction}
            active={view === LeftView.ConstructionView}
            size={"xl"}
            onClick={() => setView(view === LeftView.ConstructionView ? LeftView.None : LeftView.ConstructionView)}
          />
        ),
      },
      {
        name: MenuEnum.resourceArrivals,
        button: (
          <div className="relative">
            <CircleButton
              disabled={disableButtons}
              image={BuildingThumbs.trade}
              tooltipLocation="top"
              label="Resource Arrivals"
              active={view === LeftView.ResourceArrivals}
              size={"xl"}
              onClick={() => setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals)}
            />
            {(arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0) && (
              <div className="absolute -top-0.5 -right-0.5 flex items-center gap-0.5">
                {arrivedArrivalsNumber > 0 && (
                  <div className="bg-emerald-900/70 text-emerald-400 text-[10px] rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-emerald-700/70 animate-pulse">
                    {arrivedArrivalsNumber}
                  </div>
                )}
                {pendingArrivalsNumber > 0 && (
                  <div className="bg-amber-900/70 text-amber-400 text-[10px] rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-amber-700/70">
                    {pendingArrivalsNumber}
                  </div>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        name: MenuEnum.worldStructures,
        button: (
          <CircleButton
            disabled={disableButtons}
            image={BuildingThumbs.worldStructures}
            tooltipLocation="top"
            label={worldStructures}
            active={view === LeftView.WorldStructuresView}
            size={"xl"}
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
            disabled={disableButtons}
            className="trade-selector"
            image={BuildingThumbs.scale}
            tooltipLocation="top"
            label={trade}
            active={isPopupOpen(trade)}
            size={"xl"}
            onClick={() => toggleModal(isPopupOpen(trade) ? null : <MarketModal />)}
          />
        ),
      },
      {
        name: MenuEnum.resourceTable,
        button: (
          <CircleButton
            image={BuildingThumbs.resources}
            size={"xl"}
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
        ...(isMapView ? [] : [MenuEnum.construction]),
        MenuEnum.worldStructures,
        MenuEnum.resourceArrivals,
        MenuEnum.trade,
      ].includes(item.name as MenuEnum),
    );

    return filteredNavigation;
  }, [
    view,
    openedPopups,
    structureEntityId,
    isMapView,
    disableButtons,
    isRealmOrVillage,
    arrivedArrivalsNumber,
    pendingArrivalsNumber,
  ]);

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  const ConnectedAccount = useAccountStore((state) => state.account);

  return (
    <div className="flex flex-col">
      <div className="flex-grow overflow-hidden">
        <div
          className={`max-h-full transition-all duration-200 space-x-1 flex z-0 w-screen pr-2 md:pr-0 md:w-[600px] text-gold md:pt-16 pointer-events-none ${
            isOffscreen(view) ? "-translate-x-[89%]" : ""
          }`}
        >
          <BaseContainer
            className={`w-full panel-wood pointer-events-auto overflow-y-auto max-h-[60vh] md:max-h-[60vh] sm:max-h-[80vh] xs:max-h-[90vh] panel-wood-corners overflow-x-hidden`}
          >
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              {view === LeftView.EntityView && <EntityDetails />}
              {view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
              {!isMapView && view === LeftView.ConstructionView && (
                <SelectPreviewBuildingMenu entityId={structureEntityId} />
              )}
              {view === LeftView.WorldStructuresView && <WorldStructuresMenu />}
              {view === LeftView.ResourceArrivals && <AllResourceArrivals />}
            </Suspense>
          </BaseContainer>
          {ConnectedAccount && (
            <motion.div
              variants={slideLeft}
              initial="hidden"
              animate="visible"
              className="flex flex-col justify-center pointer-events-auto"
            >
              <div className="flex flex-col mb-auto">
                {navigation.map((item, index) => (
                  <div key={index}>{item.button}</div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <div className="flex">
        {/* <Chat /> */}
        <ChatModule />
      </div>
    </div>
  );
});

LeftNavigationModule.displayName = "LeftNavigationModule";

const isOffscreen = (view: LeftView) => {
  return view === LeftView.None;
};
