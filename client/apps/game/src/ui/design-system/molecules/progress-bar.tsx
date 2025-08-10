import { useUIStore } from "@/hooks/store/use-ui-store";
import { ReactNode } from "react";

interface ProgressBarProps {
  /** Current value display text */
  valueText: string;
  /** Percentage for the progress bar (0-100) */
  percentage: number;
  /** Color class for the progress bar fill */
  fillColor: string;
  /** Icon component to display at the end */
  icon: ReactNode;
  /** Tooltip content */
  tooltipContent: ReactNode;
  /** Additional className for the container */
  className?: string;
}

export const ProgressBar = ({
  valueText,
  percentage,
  fillColor,
  icon,
  tooltipContent,
  className,
}: ProgressBarProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div className="flex flex-row text-xxs text-gold">
      <div className="mr-1">{valueText}</div>
      <div
        onMouseEnter={() => {
          setTooltip({
            content: tooltipContent,
            position: "right",
          });
        }}
        onMouseLeave={() => {
          setTooltip(null);
        }}
        className={`flex flex-col text-xs font-bold uppercase self-center ${className}`}
      >
        <div className="bg-gray-700 rounded-full h-2 w-16 border border-gray-600 overflow-hidden">
          <div
            className={`${fillColor} h-full rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          ></div>
        </div>
      </div>
      {icon}
    </div>
  );
};
