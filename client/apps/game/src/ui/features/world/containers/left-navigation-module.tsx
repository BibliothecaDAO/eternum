import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView, RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { getEntityInfo, getIsBlitz } from "@bibliothecadao/eternum";

import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceArrivals as AllResourceArrivals, MarketModal } from "@/ui/features/economy/trading";
import { TransferAutomationPanel } from "@/ui/features/economy/transfers/transfer-automation-panel";
import { Bridge } from "@/ui/features/infrastructure";
import { ProductionOverviewPanel } from "@/ui/features/settlement/production/production-overview-panel";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { construction, military, trade } from "@/ui/features/world";
import { BOTTOM_PANEL_RESERVED_SPACE } from "@/ui/features/world/components/bottom-panels/constants";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { motion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { lazy, memo, Suspense, useMemo } from "react";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type NavigationItem = {
  id: MenuEnum;
} & Pick<
  CircleButtonProps,
  | "active"
  | "className"
  | "disabled"
  | "image"
  | "label"
  | "onClick"
  | "primaryNotification"
  | "secondaryNotification"
  | "size"
  | "tooltipLocation"
>;

type RealmNavigationContext = {
  view: LeftView;
  setView: (view: LeftView) => void;
  setRightView: (view: RightView) => void;
  disableButtons: boolean;
  isRealmOrVillage: boolean;
  isMapView: boolean;
  arrivedArrivalsNumber: number;
  pendingArrivalsNumber: number;
  toggleModal: (content: ReactNode | null) => void;
  isTradeOpen: boolean;
  isBlitz: boolean;
};

type EconomyNavigationContext = {
  rightView: RightView;
  setRightView: (view: RightView) => void;
  setLeftView: (view: LeftView) => void;
  disableButtons: boolean;
  isBlitz: boolean;
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "lg";

const buildRealmNavigationItems = ({
  view,
  setView,
  setRightView,
  disableButtons,
  isRealmOrVillage,
  isMapView,
  arrivedArrivalsNumber,
  pendingArrivalsNumber,
  toggleModal,
  isTradeOpen,
  isBlitz,
}: RealmNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: LeftView) => () => {
    setRightView(RightView.None);
    setView(view === targetView ? LeftView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.entityDetails,
      className: "entity-details-selector",
      image: BuildingThumbs.hex,
      tooltipLocation: "top",
      label: "Details",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.EntityView,
      onClick: toggleView(LeftView.EntityView),
    },
    {
      id: MenuEnum.military,
      className: "military-selector",
      image: BuildingThumbs.military,
      tooltipLocation: "top",
      label: military,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.MilitaryView,
      onClick: toggleView(LeftView.MilitaryView),
    },
    {
      id: MenuEnum.construction,
      className: "construction-selector",
      image: BuildingThumbs.construction,
      tooltipLocation: "top",
      label: construction,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons || !isRealmOrVillage || isMapView,
      active: view === LeftView.ConstructionView,
      onClick: toggleView(LeftView.ConstructionView),
    },
    {
      id: MenuEnum.resourceArrivals,
      image: BuildingThumbs.trade,
      tooltipLocation: "top",
      label: "Resource Arrivals",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === LeftView.ResourceArrivals,
      onClick: toggleView(LeftView.ResourceArrivals),

      primaryNotification:
        arrivedArrivalsNumber > 0
          ? { value: arrivedArrivalsNumber, color: "green", location: "topright" as const }
          : undefined,
      secondaryNotification:
        pendingArrivalsNumber > 0
          ? { value: pendingArrivalsNumber, color: "orange", location: "bottomright" as const }
          : undefined,
    },
    // {
    //   id: MenuEnum.hyperstructures,
    //   image: BuildingThumbs.hyperstructures,
    //   tooltipLocation: "top",
    //   label: hyperstructures,
    //   size: DEFAULT_BUTTON_SIZE,
    //   disabled: disableButtons,
    //   active: view === LeftView.HyperstructuresView,
    //   onClick: toggleView(LeftView.HyperstructuresView),
    // },
    {
      id: MenuEnum.trade,
      className: "trade-selector",
      image: BuildingThumbs.scale,
      tooltipLocation: "top",
      label: trade,
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: isTradeOpen,
      onClick: () => toggleModal(isTradeOpen ? null : <MarketModal />),
    },
    // {
    //   id: MenuEnum.relics,
    //   image: BuildingThumbs.relics,
    //   tooltipLocation: "top",
    //   label: "Relics",
    //   size: DEFAULT_BUTTON_SIZE,
    //   disabled: disableButtons,
    //   active: view === LeftView.RelicsView,
    //   onClick: toggleView(LeftView.RelicsView),
    //   primaryNotification:
    //     availableRelicsNumber > 0
    //       ? { value: availableRelicsNumber, color: "gold", location: "topright" as const }
    //       : undefined,
    // },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.entityDetails,
    MenuEnum.military,
    ...(isMapView ? [] : [MenuEnum.construction]),
    MenuEnum.hyperstructures,
    MenuEnum.resourceArrivals,
    MenuEnum.relics,
    ...(isBlitz ? [] : [MenuEnum.trade]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const buildEconomyNavigationItems = ({
  rightView,
  setRightView,
  setLeftView,
  disableButtons,
  isBlitz,
}: EconomyNavigationContext): NavigationItem[] => {
  const toggleView = (targetView: RightView) => () => {
    setLeftView(LeftView.None);
    setRightView(rightView === targetView ? RightView.None : targetView);
  };

  const items: NavigationItem[] = [
    {
      id: MenuEnum.resourceTable,
      className: "resource-table-selector",
      image: BuildingThumbs.resources,
      tooltipLocation: "top",
      label: "Balance",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: rightView === RightView.ResourceTable,
      onClick: toggleView(RightView.ResourceTable),
    },
    {
      id: MenuEnum.production,
      className: "production-selector",
      image: BuildingThumbs.production,
      tooltipLocation: "top",
      label: "Production",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Production,
      onClick: toggleView(RightView.Production),
    },
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfers",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Transfer,
      onClick: toggleView(RightView.Transfer),
    },
    {
      id: MenuEnum.bridge,
      className: "bridge-selector",
      image: BuildingThumbs.bridge,
      tooltipLocation: "top",
      label: "Bridge",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: rightView === RightView.Bridge,
      onClick: toggleView(RightView.Bridge),
    },
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: false,
      active: rightView === RightView.StoryEvents,
      onClick: toggleView(RightView.StoryEvents),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.resourceTable,
    MenuEnum.production,
    MenuEnum.transfer,
    MenuEnum.storyEvents,
    ...(isBlitz ? [] : [MenuEnum.bridge]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const EntityDetails = lazy(() =>
  import("@/ui/modules/entity-details/entity-details").then((module) => ({ default: module.EntityDetails })),
);
const Military = lazy(() => import("@/ui/features/military").then((module) => ({ default: module.Military })));
const SelectPreviewBuildingMenu = lazy(() =>
  import("@/ui/features/settlement").then((module) => ({
    default: module.SelectPreviewBuildingMenu,
  })),
);
const BlitzHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.BlitzHyperstructuresMenu,
  })),
);
const EternumHyperstructuresMenu = lazy(() =>
  import("@/ui/features/world").then((module) => ({
    default: module.EternumHyperstructuresMenu,
  })),
);
// const RelicsModule = lazy(() =>
//   import("@/ui/features/relics").then((module) => ({
//     default: module.RelicsModule,
//   })),
// );
const EntityResourceTable = lazy(() =>
  import("@/ui/features/economy/resources").then((module) => ({
    default: module.EntityResourceTable,
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
  const rightView = useUIStore((state) => state.rightNavigationView);
  const setRightView = useUIStore((state) => state.setRightNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const isTradeOpen = useUIStore((state) => state.openedPopups.includes(trade));

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const structures = useUIStore((state) => state.playerStructures);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const toggleModal = useUIStore((state) => state.toggleModal);
  const { isMapView } = useQuery();

  const isBlitz = getIsBlitz();

  const navHeight = useMemo(() => {
    if (!isMapView || showBlankOverlay) {
      return "calc(100vh - 48px)";
    }

    return `calc(100vh - ${BOTTOM_PANEL_RESERVED_SPACE}px)`;
  }, [isMapView, showBlankOverlay]);

  const structureInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), components, isBlitz),
    [structureEntityId, account.address, components, isBlitz],
  );

  const isRealmOrVillage = useMemo(
    () =>
      Boolean(structureInfo) &&
      (structureInfo?.structureCategory === StructureType.Realm ||
        structureInfo?.structureCategory === StructureType.Village),
    [structureInfo],
  );

  const realmNavigationItems = useMemo(
    () =>
      buildRealmNavigationItems({
        view,
        setView,
        setRightView,
        disableButtons,
        isRealmOrVillage,
        isMapView,
        arrivedArrivalsNumber,
        pendingArrivalsNumber,
        toggleModal,
        isTradeOpen,
        isBlitz,
      }),
    [
      view,
      setView,
      setRightView,
      disableButtons,
      isRealmOrVillage,
      isMapView,
      arrivedArrivalsNumber,
      pendingArrivalsNumber,
      toggleModal,
      isTradeOpen,
      isBlitz,
    ],
  );

  const economyNavigationItems = useMemo(
    () =>
      buildEconomyNavigationItems({
        rightView,
        setRightView,
        setLeftView: setView,
        disableButtons,
        isBlitz,
      }),
    [rightView, setRightView, setView, disableButtons, isBlitz],
  );

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  const ConnectedAccount = useAccountStore((state) => state.account);
  const isPanelCollapsed = view === LeftView.None && rightView === RightView.None;
  return (
    <div className="flex flex-col">
      <div className="flex-grow overflow-hidden">
        <div
          className={`transition-all duration-200 space-x-1 flex z-0 w-screen pr-2 md:pr-0 md:w-[900px] text-gold md:pt-16 pointer-events-none ${
            isPanelCollapsed ? "-translate-x-[92%]" : ""
          }`}
          style={{ height: navHeight, maxHeight: navHeight }}
        >
          <BaseContainer
            className="w-full panel-wood pointer-events-auto overflow-y-auto panel-wood-corners overflow-x-hidden"
            style={{ height: navHeight, maxHeight: navHeight }}
          >
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              {view === LeftView.EntityView && <EntityDetails />}
              {view === LeftView.MilitaryView && <Military entityId={structureEntityId} />}
              {!isMapView && view === LeftView.ConstructionView && (
                <SelectPreviewBuildingMenu entityId={structureEntityId} />
              )}
              {view === LeftView.HyperstructuresView &&
                (isBlitz ? <BlitzHyperstructuresMenu /> : <EternumHyperstructuresMenu />)}
              {view === LeftView.ResourceArrivals && (
                <AllResourceArrivals hasArrivals={arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0} />
              )}
              {rightView === RightView.ResourceTable && !!structureEntityId && (
                <div className="entity-resource-table-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                  <EntityResourceTable entityId={structureEntityId} />
                </div>
              )}
              {rightView === RightView.Production && (
                <div className="production-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                  <ProductionOverviewPanel />
                </div>
              )}
              {rightView === RightView.Bridge && (
                <div className="bridge-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                  <Bridge structures={structures} />
                </div>
              )}
              {rightView === RightView.Transfer && (
                <div className="transfer-selector p-2 flex flex-col space-y-1 flex-1 overflow-y-auto">
                  <TransferAutomationPanel />
                </div>
              )}
              {rightView === RightView.StoryEvents && (
                <div className="story-events-selector flex h-full flex-col flex-1 overflow-y-auto">
                  <StoryEventsChronicles />
                </div>
              )}
              {isPanelCollapsed && (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gold/70">
                  Select a module to view details.
                </div>
              )}
              {/* {view === LeftView.RelicsView && <RelicsModule />} */}
            </Suspense>
          </BaseContainer>
          {ConnectedAccount && (
            <motion.div
              variants={slideLeft}
              initial="hidden"
              animate="visible"
              className="flex flex-col justify-center pointer-events-auto"
              style={{ height: navHeight, maxHeight: navHeight }}
            >
              <div className="flex flex-col mb-auto space-y-6">
                {realmNavigationItems.length > 0 && (
                  <div>
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/60">
                      Realm
                    </p>
                    <div className="flex flex-col space-y-1">
                      {realmNavigationItems.map((item) => (
                        <div key={item.id}>
                          <CircleButton {...item} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {economyNavigationItems.length > 0 && (
                  <div>
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold/60">
                      Economy
                    </p>
                    <div className="flex flex-col space-y-1">
                      {economyNavigationItems.map((item) => (
                        <div key={item.id}>
                          <CircleButton {...item} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
});

LeftNavigationModule.displayName = "LeftNavigationModule";
