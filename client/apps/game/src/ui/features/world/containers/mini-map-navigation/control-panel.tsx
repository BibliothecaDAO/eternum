import { ReactComponent as CollapseIcon } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as ExpandIcon } from "@/assets/icons/common/expand.svg";
import type { ReactNode } from "react";
import { memo } from "react";

interface MiniMapControlPanelProps {
  isExpanded: boolean;
  onMinimize: () => void;
  onToggleExpand: () => void;
  onScreenshot: () => void;
  onHover: (content: string) => void;
  onLeave: () => void;
}

const ControlButton = ({
  onClick,
  children,
  onHover,
  onLeave,
}: {
  onClick: () => void;
  children: ReactNode;
  onHover: () => void;
  onLeave: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer hover:opacity-80"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  );
};

export const MiniMapControlPanel = memo(({
  isExpanded,
  onMinimize,
  onToggleExpand,
  onScreenshot,
  onHover,
  onLeave,
}: MiniMapControlPanelProps) => {
  return (
    <div className="flex items-center gap-2">
      {isExpanded && (
        <ControlButton onClick={onScreenshot} onHover={() => onHover("Save World Map")} onLeave={onLeave}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
          >
            <path d="M12 16L12 8M12 16L8 12M12 16L16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M3 15L3 16C3 18.2091 4.79086 20 7 20L17 20C19.2091 20 21 18.2091 21 16L21 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ControlButton>
      )}
      <ControlButton onClick={onMinimize} onHover={() => onHover("Minimize Minimap")} onLeave={onLeave}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <path d="M6 12L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>
      <ControlButton
        onClick={onToggleExpand}
        onHover={() => onHover(isExpanded ? "Collapse Minimap" : "Expand Minimap")}
        onLeave={onLeave}
      >
        {isExpanded ? <CollapseIcon className="w-4 h-4" /> : <ExpandIcon className="w-4 h-4" />}
      </ControlButton>
    </div>
  );
});

MiniMapControlPanel.displayName = "MiniMapControlPanel";
