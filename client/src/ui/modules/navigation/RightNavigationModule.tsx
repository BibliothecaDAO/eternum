import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import Button from "@/ui/elements/Button";
import CircleButton from "@/ui/elements/CircleButton";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { motion } from "framer-motion";
import { Suspense, lazy, useMemo } from "react";
import { BaseContainer } from "../../containers/BaseContainer";

const EntityResourceTable = lazy(() =>
  import("../../components/resources/EntityResourceTable").then((module) => ({ default: module.EntityResourceTable })),
);

export enum RightView {
  None,
  ResourceTable,
}

export const RightNavigationModule = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);

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
              <a
                className="text-brown cursor-pointer text-lg w-full"
                href={`https://empire.realms.world/trade`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="w-full">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resource="Lords" size="xs" />
                    Bridge Lords & Resources
                  </div>
                </Button>
              </a>
              <EntityResourceTable entityId={structureEntityId} />
            </div>
          )}
        </Suspense>
      </BaseContainer>
    </div>
  );
};
