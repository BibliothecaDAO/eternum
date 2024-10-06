import { useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import useUIStore from "@/hooks/store/useUIStore";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/CircleButton";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BaseContainer } from "../../containers/BaseContainer";

export enum View {
  None,
  ResourceTable,
  ResourceArrivals,
}

export const RightNavigationModule = () => {
  const view = useUIStore((state) => state.rightNavigationView);
  const setView = useUIStore((state) => state.setRightNavigationView);

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { questClaimStatus } = useQuestClaimStatus();

  const navigation = useMemo(() => {
    return [
      {
        name: "resourceTable",
        button: (
          <CircleButton
            image={BuildingThumbs.resources}
            size="xl"
            tooltipLocation="top"
            label={"Balance"}
            active={view === View.ResourceTable}
            onClick={() => {
              if (view === View.ResourceTable) {
                setView(View.None);
              } else {
                setView(View.ResourceTable);
              }
            }}
          />
        ),
      },
    ];
  }, [location, view, questClaimStatus, structureEntityId]);

  const slideRight = {
    hidden: { x: "100%" },
    visible: { x: "0%", transition: { duration: 0.5 } },
  };

  return (
    <>
      <div
        className={`max-h-full transition-all z-0 duration-200 space-x-1 flex w-[400px] right-4 self-center pointer-events-none ${
          isOffscreen(view) ? "translate-x-[83%]" : ""
        }`}
      >
        <motion.div
          variants={slideRight}
          initial="hidden"
          animate="visible"
          className="gap-2 flex flex-col justify-center self-center pointer-events-auto"
        >
          <div className="flex flex-col gap-2 mb-auto">
            {navigation.map((a, index) => (
              <div key={index}>{a.button}</div>
            ))}
          </div>
        </motion.div>

        <BaseContainer
          className={`w-full pointer-events-auto overflow-y-scroll ${isOffscreen(view) ? "h-[20vh]" : "h-[80vh]"}`}
        >
          {structureEntityId && (
            <div className="p-2 flex flex-col space-y-1 overflow-y-auto">
              <EntityResourceTable entityId={structureEntityId} />
            </div>
          )}
        </BaseContainer>
      </div>
    </>
  );
};

const isOffscreen = (view: View) => {
  return view === View.None;
};
