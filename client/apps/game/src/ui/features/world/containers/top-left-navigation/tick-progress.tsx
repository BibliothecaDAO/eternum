import { useUISound } from "@/audio";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, formatTime, getIsBlitz } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

const PHASES = [
  { name: "Early Hours" },
  { name: "Dawn" },
  { name: "Morning" },
  { name: "Afternoon" },
  { name: "Dusk" },
  { name: "Late Evening" },
] as const;

export const TickProgress = memo(() => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setCycleProgress = useUIStore((state) => state.setCycleProgress);
  const setCycleTime = useUIStore((state) => state.setCycleTime);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const cycleTime = configManager.getTick(TickIds.Armies);
  const dayDuration = cycleTime * PHASES.length;
  const playGong = useUISound(getIsBlitz() ? "event.blitz_gong" : "event.gong");

  const lastProgressRef = useRef(0);

  const phaseData = useMemo(() => {
    const dayElapsed = currentBlockTimestamp % dayDuration;
    const currentPhase = Math.floor(dayElapsed / cycleTime);
    const phaseElapsed = dayElapsed % cycleTime;

    return {
      currentPhase,
      phaseProgress: (phaseElapsed / cycleTime) * 100,
      phaseName: PHASES[currentPhase]?.name || "Unknown",
    };
  }, [currentBlockTimestamp, cycleTime, dayDuration]);

  useEffect(() => {
    setCycleProgress(phaseData.phaseProgress);
    setCycleTime(cycleTime);
  }, [phaseData.phaseProgress, cycleTime, setCycleProgress, setCycleTime]);

  useEffect(() => {
    if (lastProgressRef.current > phaseData.phaseProgress) {
      playGong();
    }
    lastProgressRef.current = phaseData.phaseProgress;
  }, [phaseData.phaseProgress, playGong]);

  const tooltipContent = useMemo(
    () => (
      <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
        <div>
          Current phase: <span className="font-bold">{phaseData.phaseName}</span>
        </div>
        <div>
          A day in Realms is <span className="font-bold">{formatTime(dayDuration)}</span> ({PHASES.length} phases)
        </div>
        <div>
          Time left in {phaseData.phaseName}:{" "}
          <span className="font-bold">{formatTime(cycleTime - (currentBlockTimestamp % cycleTime))}</span>
        </div>
      </div>
    ),
    [phaseData.phaseName, dayDuration, cycleTime, currentBlockTimestamp],
  );

  const handleMouseEnter = useCallback(() => {
    setTooltip({
      position: "bottom",
      content: tooltipContent,
    });
  }, [setTooltip, tooltipContent]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const size = 32;
  const center = size / 2;
  const radius = 12;
  const outerRadius = 14;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="self-center text-center px-1 py-1 flex gap-1 text-xl items-center"
    >
      <div className="relative w-8 h-8">
        <svg width={size} height={size} className="transform -rotate-90">
          {PHASES.map((phase, index) => {
            const angle = 360 / PHASES.length;
            const startAngle = index * angle;
            const endAngle = startAngle + angle;

            const startAngleRad = (startAngle * Math.PI) / 180;
            const endAngleRad = (endAngle * Math.PI) / 180;

            const x1 = center + radius * Math.cos(startAngleRad);
            const y1 = center + radius * Math.sin(startAngleRad);
            const x2 = center + radius * Math.cos(endAngleRad);
            const y2 = center + radius * Math.sin(endAngleRad);

            const pathData = [
              `M ${center} ${center}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`,
              "Z",
            ].join(" ");

            const isCompleted = index < phaseData.currentPhase;
            const isCurrent = index === phaseData.currentPhase;
            const fillOpacity = isCompleted ? 1 : isCurrent ? phaseData.phaseProgress / 100 : 0;

            return (
              <g key={`${phase.name}-${index}`}>
                <path d={pathData} fill="#2a2a2a" opacity="0.3" stroke="#2a2a2a" strokeWidth="0.5" />
                <path d={pathData} fill="#dfaa54" opacity={fillOpacity} stroke="#2a2a2a" strokeWidth="0.5" />
              </g>
            );
          })}

          <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="#2a2a2a" strokeWidth="1" opacity="0.3" />
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="#dfaa54"
            strokeWidth="1"
            strokeDasharray={`${2 * Math.PI * outerRadius}`}
            strokeDashoffset={`${2 * Math.PI * outerRadius * (1 - phaseData.phaseProgress / 100)}`}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <ResourceIcon withTooltip={false} resource="Timeglass" size="xs" className="self-center" />
        </div>
      </div>
      <span className="text-sm">{phaseData.phaseProgress.toFixed(0)}%</span>
    </div>
  );
});

TickProgress.displayName = "TickProgress";
