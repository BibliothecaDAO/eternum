import useUIStore from "@/hooks/store/use-ui-store";
import { IS_MOBILE } from "@/ui/config";

export const ActionInstructions = () => {
  const selectedEntityId = useUIStore((state) => state.armyActions.selectedEntityId);

  return (
    <>
      {selectedEntityId && (
        <div className="text-xs fixed left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-green text-center text-xxs md:text-base textpy-1 md:py-2 z-50 w-[200px] md:w-[300px] top-[60px] rounded-lg animate-pulse pointer-events-none">
          {IS_MOBILE ? "Tap another hex to exit travel mode" : "Press Esc to exit travel mode. "}
          <br />
          {IS_MOBILE ? "Long press to confirm movement" : "Right-click to confirm movement"}
        </div>
      )}
    </>
  );
};
