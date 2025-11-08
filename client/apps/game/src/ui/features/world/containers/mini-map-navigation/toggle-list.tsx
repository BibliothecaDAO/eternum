import type { MiniMapToggleConfig, MiniMapToggleKey, VisibilityState } from "./config";

interface MiniMapToggleListProps {
  toggles: MiniMapToggleConfig[];
  visibility: VisibilityState;
  isExpanded: boolean;
  onToggle: (toggle: MiniMapToggleKey, checked: boolean) => void;
  onHover: (content: string) => void;
  onLeave: () => void;
}

export const MiniMapToggleList = ({
  toggles,
  visibility,
  isExpanded,
  onToggle,
  onHover,
  onLeave,
}: MiniMapToggleListProps) => {
  return (
    <div className="flex w-full min-w-0 flex-nowrap overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
      {toggles.map((toggle) => {
        const isActive = visibility[toggle.id];

        return (
          <div
            key={toggle.id}
            className="flex items-center gap-1 flex-shrink-0"
            onMouseEnter={() => onHover(`Toggle ${toggle.label}`)}
            onMouseLeave={onLeave}
          >
            <div className="relative inline-block">
              <input
                type="checkbox"
                id={`toggle-${toggle.id}`}
                checked={isActive}
                onChange={(event) => onToggle(toggle.id, event.target.checked)}
                className="sr-only peer"
              />
              <label htmlFor={`toggle-${toggle.id}`} className="flex items-center cursor-pointer group">
                <div className="relative w-4 h-4 mr-1.5 bg-gray-900/90 border border-amber-800/90 hover:border-amber-600 rounded-sm overflow-hidden shadow-inner shadow-black/50">
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-600/80 to-amber-800/90 flex items-center justify-center shadow-md">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#FFF"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3 h-3 drop-shadow-md"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <img
                  src={toggle.imagePath}
                  alt={toggle.label}
                  className={`w-4 h-4 mr-1 ${isActive ? "brightness-100" : "brightness-50"}`}
                />
                {isExpanded && (
                  <span className={`text-white text-opacity-90 ${isActive ? "brightness-100" : "brightness-50"}`}>
                    {toggle.label}
                  </span>
                )}
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
};
