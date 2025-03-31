import { useUIStore } from "@/hooks/store/use-ui-store";

export const ActionInstructions = () => {
  const selectedEntityId = useUIStore((state) => state.entityActions.selectedEntityId);

  return (
    <>
      {selectedEntityId && (
        <div className="text-xs fixed left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-green text-center  md:text-base textpy-1 md:py-2 z-50 w-[200px] md:w-[300px] top-[60px] rounded-lg animate-pulse pointer-events-none">
          {"Press Esc to exit action mode. "}
          <br />
          {"Right-click to confirm action"}
        </div>
      )}
    </>
  );
};
