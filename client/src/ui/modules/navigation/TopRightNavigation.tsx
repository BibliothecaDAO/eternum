import useUIStore from "@/hooks/store/useUIStore";

export const MiniMapNavigation = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const showMinimap = useUIStore((state) => state.showMinimap);

  return (
    <div className=" bottom-[10px] left-[10px] z-[1001] text-xxs pointer-events-auto flex flex-col self-end ">
      <canvas
        id="minimap"
        width={200}
        height={112}
        className="border border-gold/30 rounded-tr-xl bg-hex-bg "
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          zIndex: 2,
        }}
      />
      <div className="flex justify-between ml-auto">
        {showMinimap && (
          <div
            onMouseEnter={() =>
              setTooltip({
                content: (
                  <div className="flex flex-col whitespace-nowrap text-xxs">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FF0000] rounded-full"></div>
                      <div>Armies</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#00FF00] rounded-full"></div>
                      <div>My Armies</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#0000ff] rounded-full"></div>
                      <div>Realm</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FFFFFF] rounded-full"></div>
                      <div>Hyperstructure</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FFFF00] rounded-full"></div>
                      <div>Bank</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#00FFFF] rounded-full"></div>
                      <div>Fragment Mine</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#FFA500] rounded-full"></div>
                      <div>Settlement</div>
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
        )}
      </div>
    </div>
  );
};
