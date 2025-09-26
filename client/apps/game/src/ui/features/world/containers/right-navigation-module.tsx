import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { getIsBlitz } from "@bibliothecadao/eternum";
import clsx from "clsx";

import CircleButton from "@/ui/design-system/molecules/circle-button";
import { AllAutomationsTable, AutomationTransferTable, Bridge, TransferModal } from "@/ui/features/infrastructure";
import { ProductionModal } from "@/ui/features/settlement";
import { StoryEventsChronicles } from "@/ui/features/story-events";
import { BaseContainer } from "@/ui/shared/containers/base-container";
import { motion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";
import { Suspense, lazy, useMemo } from "react";

type CircleButtonProps = ComponentProps<typeof CircleButton>;

type RightNavigationItem = {
  id: MenuEnum;
} & Pick<
  CircleButtonProps,
  "active" | "className" | "disabled" | "image" | "label" | "onClick" | "size" | "tooltipLocation"
>;

type RightNavigationContext = {
  view: RightView;
  setView: (view: RightView) => void;
  disableButtons: boolean;
  toggleModal: (content: ReactNode | null) => void;
  isBlitz: boolean;
};

const DEFAULT_BUTTON_SIZE: CircleButtonProps["size"] = "xl";

const buildRightNavigationItems = ({
  view,
  setView,
  disableButtons,
  toggleModal,
  isBlitz,
}: RightNavigationContext): RightNavigationItem[] => {
  const toggleView = (targetView: RightView) => () => setView(view === targetView ? RightView.None : targetView);

  const items: RightNavigationItem[] = [
    {
      id: MenuEnum.resourceTable,
      className: "resource-table-selector",
      image: BuildingThumbs.resources,
      tooltipLocation: "top",
      label: "Balance",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.ResourceTable,
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
      active: view === RightView.Production,
      onClick: () => toggleModal(<ProductionModal />),
    },
    {
      id: MenuEnum.transfer,
      className: "transfer-selector",
      image: BuildingThumbs.transfer,
      tooltipLocation: "top",
      label: "Transfer",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Transfer,
      onClick: () => toggleModal(<TransferModal />),
    },
    {
      id: MenuEnum.automation,
      className: "automation-selector",
      image: BuildingThumbs.automation,
      tooltipLocation: "top",
      label: "Automation",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Automation,
      onClick: toggleView(RightView.Automation),
    },
    {
      id: MenuEnum.bridge,
      className: "bridge-selector",
      image: BuildingThumbs.bridge,
      tooltipLocation: "top",
      label: "Bridge",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Bridge,
      onClick: toggleView(RightView.Bridge),
    },
    {
      id: MenuEnum.storyEvents,
      className: "story-events-selector",
      image: BuildingThumbs.storyEvents,
      tooltipLocation: "top",
      label: "Activity Chronicles",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.StoryEvents,
      onClick: toggleView(RightView.StoryEvents),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.resourceTable,
    MenuEnum.production,
    MenuEnum.automation,
    MenuEnum.storyEvents,
    MenuEnum.transfer,
    ...(isBlitz ? [] : [MenuEnum.bridge]),
  ];

  return items.filter((item) => allowedMenus.includes(item.id));
};

const EntityResourceTable = lazy(() =>
  import("@/ui/features/economy/resources").then((module) => ({
    default: module.EntityResourceTable,
  })),
);

export const RightNavigationModule = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const disableButtons = useUIStore((state) => state.disableButtons);
  const structures = useUIStore((state) => state.playerStructures);

  const ConnectedAccount = useAccountStore((state) => state.account);

  const isBlitz = getIsBlitz();

  const navigationItems = useMemo(
    () =>
      buildRightNavigationItems({
        view,
        setView,
        disableButtons,
        toggleModal,
        isBlitz,
      }),
    [view, setView, disableButtons, toggleModal, isBlitz],
  );

  const isOffscreen = view === RightView.None;

  const storyChroniclesActive = view === RightView.StoryEvents;

  return (
    <div
      className={clsx(
        "pointer-events-none right-4 flex max-h-full space-x-1 pt-16 transition-all duration-300",
        storyChroniclesActive ? "w-[48vw] max-w-[825px]" : "w-[500px]",
        isOffscreen ? "translate-x-[86%]" : "",
      )}
    >
      {ConnectedAccount && (
        <>
          <motion.div
            variants={{
              hidden: { x: "100%" },
              visible: { x: "0%", transition: { duration: 0.5 } },
            }}
            initial="hidden"
            animate="visible"
            className={clsx(
              "pointer-events-auto flex flex-col justify-start",
              storyChroniclesActive ? "h-[88vh]" : "h-[60vh]",
            )}
          >
            <div className="flex flex-col mb-auto">
              {navigationItems.map((item) => (
                <div key={item.id}>
                  <CircleButton {...item} />
                </div>
              ))}
            </div>
          </motion.div>

          <BaseContainer
            className={clsx(
              "panel-wood panel-wood-corners w-full rounded-l-2xl border-l-2 border-y-2 border-gold/20 pointer-events-auto overflow-x-hidden",
              storyChroniclesActive ? "h-[88vh] overflow-y-auto" : "h-[60vh] overflow-y-auto",
            )}
          >
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              {view === RightView.ResourceTable && !!structureEntityId && (
                <div className="entity-resource-table-selector p-2 flex flex-col space-y-1 overflow-y-auto">
                  <EntityResourceTable entityId={structureEntityId} />
                </div>
              )}
              {view === RightView.Bridge && (
                <div className="bridge-selector p-2 flex flex-col space-y-1 overflow-y-auto">
                  <Bridge structures={structures} />
                </div>
              )}
              {view === RightView.Automation && (
                <div className="automation-selector p-2 flex flex-col space-y-1 overflow-y-auto">
                  <AllAutomationsTable />
                </div>
              )}
              {storyChroniclesActive && (
                <div className="story-events-selector flex h-full flex-col">
                  <StoryEventsChronicles />
                </div>
              )}
              {view === RightView.Transfer && (
                <div className="transfer-selector p-2 flex flex-col space-y-1 overflow-y-auto">
                  <AutomationTransferTable />
                </div>
              )}
            </Suspense>
          </BaseContainer>
        </>
      )}
    </div>
  );
};
