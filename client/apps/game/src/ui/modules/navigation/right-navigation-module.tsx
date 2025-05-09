import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RightView } from "@/types";
import { Bridge } from "@/ui/components/bridge/bridge";
import { ProductionModal } from "@/ui/components/production/production-modal";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/elements/circle-button";
import { getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, PlayerStructure } from "@bibliothecadao/types";
import { motion } from "framer-motion";
import { Suspense, lazy, useMemo } from "react";
import { BaseContainer } from "../../containers/base-container";

const EntityResourceTable = lazy(() =>
  import("@/ui/components/resources/entity-resource-table").then((module) => ({ default: module.EntityResourceTable })),
);

export const RightNavigationModule = ({ structures }: { structures: PlayerStructure[] }) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const disableButtons = useUIStore((state) => state.disableButtons);

  const ConnectedAccount = useAccountStore((state) => state.account);

  const {
    setup: { components },
  } = useDojo();

  const structureInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(ConnectedAccount?.address || "0x0"), components),
    [structureEntityId, ConnectedAccount?.address, components],
  );

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
    ],
    [view, structureEntityId],
  );

  const isOffscreen = view === RightView.None;

  return (
    <div
      className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[400px] right-4 pointer-events-none pt-16 ${
        isOffscreen ? "translate-x-[83%]" : ""
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
              {navigation.map((item, index) => (
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
            </Suspense>
          </BaseContainer>
        </>
      )}
    </div>
  );
};
