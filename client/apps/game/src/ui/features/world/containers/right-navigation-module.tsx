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
import { Suspense, lazy, useMemo } from "react";

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

  const navigation = useMemo(
    () => [
      {
        name: MenuEnum.resourceTable,
        button: (
          <CircleButton
            className="resource-table-selector"
            image={BuildingThumbs.resources}
            disabled={disableButtons}
            size="xl"
            tooltipLocation="top"
            label="Balance"
            active={view === RightView.ResourceTable}
            onClick={() => setView(view === RightView.ResourceTable ? RightView.None : RightView.ResourceTable)}
          />
        ),
      },
      {
        name: MenuEnum.production,
        button: (
          <CircleButton
            className="production-selector"
            image={BuildingThumbs.production}
            size="xl"
            disabled={disableButtons}
            tooltipLocation="top"
            label="Production"
            active={view === RightView.Production}
            onClick={() => {
              toggleModal(<ProductionModal />);
            }}
          />
        ),
      },
      {
        name: MenuEnum.transfer,
        button: (
          <CircleButton
            className="transfer-selector"
            image={BuildingThumbs.transfer}
            size="xl"
            disabled={disableButtons}
            tooltipLocation="top"
            label="Transfer"
            active={view === RightView.Transfer}
            onClick={() => {
              toggleModal(<TransferModal />);
            }}
          />
        ),
      },
      {
        name: MenuEnum.automation,
        button: (
          <CircleButton
            className="automation-selector"
            image={BuildingThumbs.automation}
            size="xl"
            disabled={disableButtons}
            tooltipLocation="top"
            label="Automation"
            active={view === RightView.Automation}
            onClick={() => setView(view === RightView.Automation ? RightView.None : RightView.Automation)}
          />
        ),
      },
      {
        name: MenuEnum.bridge,
        button: (
          <CircleButton
            className="bridge-selector"
            image={BuildingThumbs.bridge}
            size="xl"
            disabled={disableButtons}
            tooltipLocation="top"
            label="Bridge"
            active={view === RightView.Bridge}
            onClick={() => setView(view === RightView.Bridge ? RightView.None : RightView.Bridge)}
          />
        ),
      },
      {
        name: MenuEnum.logs,
        button: (
          <CircleButton
            className="logs-selector"
            image={BuildingThumbs.logs}
            size="xl"
            disabled={disableButtons}
            tooltipLocation="top"
            label="Logs"
            active={view === RightView.Logs}
            onClick={() => setView(view === RightView.Logs ? RightView.None : RightView.Logs)}
          />
        ),
      },
    ],
    [view, structureEntityId, disableButtons],
  );

  const isOffscreen = view === RightView.None;

  const filteredNavigation = navigation.filter((item) =>
    [
      MenuEnum.resourceTable,
      MenuEnum.production,
      MenuEnum.automation,
      ...(getIsBlitz() ? [] : [MenuEnum.bridge]),
      MenuEnum.logs,
      MenuEnum.transfer,
    ].includes(item.name as MenuEnum),
  );

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
              {filteredNavigation.map((item, index) => (
                <div key={index}>{item.button}</div>
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
