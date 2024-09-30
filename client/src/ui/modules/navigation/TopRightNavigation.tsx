import useUIStore from "@/hooks/store/useUIStore";

export const TopRightNavigation = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div className="absolute top-[125px] right-[15px] z-[1001] text-xxs opacity-50 pointer-events-auto flex justify-between">
      <div>toggle armies</div>
      <div
        onMouseEnter={() =>
          setTooltip({
            content: (
              <div className="flex flex-col  whitespace-nowrap text-xxs">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-[#FF0000] rounded-full"></div>
                  <div>Armies</div>
                </div>
                <div className="flex items-center space-x-2 ">
                  <div className="w-2 h-2 bg-[#00FF00] rounded-full"></div>
                  <div>My Armies</div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-[#0000FF] rounded-full"></div>
                  <div>Buildings</div>
                </div>
              </div>
            ),
            position: "bottom",
          })
        }
        onMouseLeave={() => setTooltip(null)}
      >
        Legend
      </div>
    </div>
  );
};
