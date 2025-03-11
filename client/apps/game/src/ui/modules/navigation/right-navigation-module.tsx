import { useUIStore } from "@/hooks/store/use-ui-store";
import { RightView } from "@/types";
import { ProductionModal } from "@/ui/components/production/production-modal";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/elements/circle-button";
import { motion } from "framer-motion";
import { Suspense, lazy, useMemo } from "react";
import { BaseContainer } from "../../containers/base-container";

const EntityResourceTable = lazy(() =>
  import("@/ui/components/resources/entity-resource-table").then((module) => ({ default: module.EntityResourceTable })),
);

export const RightNavigationModule = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const navigation = useMemo(
    () => [
      {
        name: MenuEnum.resourceTable,
        button: (
          <CircleButton
            className="resource-table-selector"
            image={BuildingThumbs.resources}
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
            tooltipLocation="top"
            label="Production"
            active={view === RightView.Production}
            onClick={() => {
              toggleModal(<ProductionModal />);
            }}
          />
        ),
      },
    ],
    [view, structureEntityId],
  );

  const isOffscreen = view === RightView.None;

  return (
    <div
      className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[400px] right-4 pointer-events-none pt-36 ${
        isOffscreen ? "translate-x-[83%]" : ""
      }`}
    >
      <motion.div
        variants={{
          hidden: { x: "100%" },
          visible: { x: "0%", transition: { duration: 0.5 } },
        }}
        initial="hidden"
        animate="visible"
        className="gap-2 flex flex-col justify-start pointer-events-auto h-[60vh]"
      >
        <div className="flex flex-col gap-2 mb-auto">
          {navigation.map((item, index) => (
            <div key={index}>{item.button}</div>
          ))}
        </div>
      </motion.div>

      <BaseContainer
        className={`w-full pointer-events-auto overflow-y-scroll h-[60vh] rounded-l-2xl border-l-2 border-y-2 border-gold/20`}
      >
        <Suspense fallback={<div className="p-8">Loading...</div>}>
          {!!structureEntityId && (
            <div className="entity-resource-table-selector p-2 flex flex-col space-y-1 overflow-y-auto">
              <EntityResourceTable entityId={structureEntityId} />
            </div>
          )}
        </Suspense>
      </BaseContainer>
    </div>
  );
};
