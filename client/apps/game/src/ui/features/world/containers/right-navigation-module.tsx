import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RightView } from "@/types";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import { getIsBlitz } from "@bibliothecadao/eternum";

import CircleButton from "@/ui/design-system/molecules/circle-button";
import { AllAutomationsTable, AutomationTransferTable, Bridge, TransferModal } from "@/ui/features/infrastructure";
import { BattleLogsTable } from "@/ui/features/military";
import { ProductionModal } from "@/ui/features/settlement";
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
      id: MenuEnum.logs,
      className: "logs-selector",
      image: BuildingThumbs.logs,
      tooltipLocation: "top",
      label: "Logs",
      size: DEFAULT_BUTTON_SIZE,
      disabled: disableButtons,
      active: view === RightView.Logs,
      onClick: toggleView(RightView.Logs),
    },
  ];

  const allowedMenus: MenuEnum[] = [
    MenuEnum.resourceTable,
    MenuEnum.production,
    MenuEnum.automation,
    MenuEnum.logs,
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

  return (
    <div
      className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[500px] right-4 pointer-events-none pt-16 ${
        isOffscreen ? "translate-x-[86%]" : ""
      }`}
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
            className="flex flex-col justify-start pointer-events-auto h-[60vh]"
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
            className={`w-full panel-wood pointer-events-auto overflow-y-auto h-[60vh] rounded-l-2xl border-l-2 border-y-2 panel-wood-corners border-gold/20 overflow-x-hidden`}
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
              {view === RightView.Logs && (
                <div className="logs-selector p-2 flex flex-col space-y-1 overflow-y-auto">
                  <BattleLogsTable />
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
