import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { getIsBlitz } from "@bibliothecadao/eternum";

import CircleButton from "@/ui/design-system/molecules/circle-button";
import { ResourceArrivals as AllResourceArrivals, MarketModal } from "@/ui/features/economy/trading";
import { construction, military, trade } from "@/ui/features/world";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { motion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { lazy, memo, Suspense, useMemo } from "react";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type LeftNavigationItem = {
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

type LeftNavigationContext = {
  view: LeftView;
  setView: (view: LeftView) => void;
  disableButtons: boolean;
  isRealmOrVillage: boolean;
  isMapView: boolean;
  arrivedArrivalsNumber: number;
  pendingArrivalsNumber: number;
  toggleModal: (content: ReactNode | null) => void;
  isTradeOpen: boolean;
  isBlitz: boolean;
  availableRelicsNumber: number;
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "lg";

const buildLeftNavigationItems = ({
  view,
  setView,
  disableButtons,
  isRealmOrVillage,
  isMapView,
  arrivedArrivalsNumber,
  pendingArrivalsNumber,
  toggleModal,
  isTradeOpen,
  isBlitz,
  availableRelicsNumber,
}: LeftNavigationContext): LeftNavigationItem[] => {
  const toggleView = (targetView: LeftView) => () => setView(view === targetView ? LeftView.None : targetView);

  const items: LeftNavigationItem[] = [
    {
      id: MenuEnum.entityDetails,
      className: "entity-details-selector",
      image: BuildingThumbs.hex,
      tooltipLocation: "top",
      label: "Details",
      size: DEFAULT_BUTTON_SIZE,
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

export const LeftNavigationModule = memo(() => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const availableRelicsNumber = useUIStore((state) => state.availableRelicsNumber);

  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const isTradeOpen = useUIStore((state) => state.openedPopups.includes(trade));

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const isBottomHudMinimized = useUIStore((state) => state.isBottomHudMinimized);
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);

  const toggleModal = useUIStore((state) => state.toggleModal);
  const { isMapView } = useQuery();

  const isBlitz = getIsBlitz();

  const isBottomHudVisible = isMapView && !showBlankOverlay;
  const navHeight = useMemo(() => {
    if (!isBottomHudVisible) {
      return "calc(100vh - 48px)";
    }

    return isBottomHudMinimized ? "calc(100vh - 180px)" : "calc(100vh - 30vh)";
  }, [isBottomHudVisible, isBottomHudMinimized]);

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

  const navigationItems = useMemo(
    () =>
      buildLeftNavigationItems({
        view,
        setView,
        disableButtons,
        isRealmOrVillage,
        isMapView,
        arrivedArrivalsNumber,
        pendingArrivalsNumber,
        toggleModal,
        isTradeOpen,
        isBlitz,
        availableRelicsNumber,
      }),
    [
      view,
      setView,
      disableButtons,
      isRealmOrVillage,
      isMapView,
      arrivedArrivalsNumber,
      pendingArrivalsNumber,
      toggleModal,
      isTradeOpen,
      isBlitz,
      availableRelicsNumber,
    ],
  );

  const slideLeft = {
    hidden: { x: "-100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  const ConnectedAccount = useAccountStore((state) => state.account);
  return (
    <div className="flex flex-col">
      <div className="flex-grow overflow-hidden">
        <div
          className={`transition-all duration-200 space-x-1 flex z-0 w-screen pr-2 md:pr-0 md:w-[600px] text-gold md:pt-16 pointer-events-none ${
            isOffscreen(view) ? "-translate-x-[92%]" : ""
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
              <div className="flex flex-col mb-auto space-y-1">
                {navigationItems.map((item) => (
                  <div key={item.id}>
                    <CircleButton {...item} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
});

LeftNavigationModule.displayName = "LeftNavigationModule";

const isOffscreen = (view: LeftView) => {
  return view === LeftView.None;
};
