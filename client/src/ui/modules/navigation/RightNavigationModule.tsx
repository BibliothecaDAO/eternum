import { useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import useUIStore from "@/hooks/store/useUIStore";
import { BuildingThumbs, MenuEnum } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
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

  const { questClaimStatus } = useQuestClaimStatus();

  const navigation = useMemo(
    () => [
      {
        name: MenuEnum.resourceTable,
        button: (
          <CircleButton
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
    [view, questClaimStatus, structureEntityId],
  );

  const isOffscreen = view === RightView.None;

  return (
    <div
      className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[400px] right-4 pointer-events-none pt-24 ${
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
            <div className="p-2 flex flex-col space-y-1 overflow-y-auto">
              <EntityResourceTable entityId={structureEntityId} />
            </div>
          )}
        </Suspense>
      </BaseContainer>
    </div>
  );
};
