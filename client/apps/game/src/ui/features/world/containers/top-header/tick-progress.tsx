import { useUISound } from "@/audio";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, formatTime } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const PHASES = [
  { key: "early-hours", name: "Early Hours", lightProgress: 11.5 },
  { key: "dawn", name: "Dawn", lightProgress: 18.75 },
  { key: "morning", name: "Morning", lightProgress: 37.5 },
  { key: "afternoon", name: "Afternoon", lightProgress: 56.25 },
  { key: "dusk", name: "Dusk", lightProgress: 68.75 },
  { key: "late-evening", name: "Late Evening", lightProgress: 79 },
] as const;

type LightPhaseSelection = "live" | (typeof PHASES)[number]["key"];

const resolveForcedPhase = (selection: LightPhaseSelection) => {
  if (selection === "live") {
    return null;
  }

  return PHASES.find((phase) => phase.key === selection) ?? null;
};

export const TickProgress = memo(() => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setCycleProgress = useUIStore((state) => state.setCycleProgress);
  const setCycleTime = useUIStore((state) => state.setCycleTime);
  const { currentBlockTimestamp } = useBlockTimestamp();
  const mode = useGameModeConfig();
  const [lightPhaseSelection, setLightPhaseSelection] = useState<LightPhaseSelection>("live");

  const cycleTime = configManager.getTick(TickIds.Armies);
  const hasValidCycle = cycleTime > 0;
  const dayDuration = hasValidCycle ? cycleTime * PHASES.length : 1;
  const playGong = useUISound(mode.audio.tickGongSound);

  const lastProgressRef = useRef(0);

  const phaseData = useMemo(() => {
    const dayElapsed = hasValidCycle ? currentBlockTimestamp % dayDuration : 0;
    const currentPhase = hasValidCycle ? Math.floor(dayElapsed / cycleTime) : 0;
    const phaseElapsed = hasValidCycle ? dayElapsed % cycleTime : 0;
    const phaseProgress = hasValidCycle ? (phaseElapsed / cycleTime) * 100 : 0;
    const dayProgress = hasValidCycle ? (dayElapsed / dayDuration) * 100 : 0;

    const clampedPhase = Math.min(Math.max(currentPhase, 0), PHASES.length - 1);

    return {
      currentPhase: clampedPhase,
      phaseProgress,
      phaseName: PHASES[clampedPhase]?.name || "Unknown",
      dayProgress,
    };
  }, [currentBlockTimestamp, cycleTime, dayDuration, hasValidCycle]);

  const forcedPhase = useMemo(() => resolveForcedPhase(lightPhaseSelection), [lightPhaseSelection]);

  const cycleProgressForLighting = forcedPhase?.lightProgress ?? phaseData.dayProgress;

  const timeLeftInPhase = useMemo(() => {
    if (!hasValidCycle) {
      return 0;
    }

    return cycleTime - (currentBlockTimestamp % cycleTime);
  }, [hasValidCycle, currentBlockTimestamp, cycleTime]);

  useEffect(() => {
    setCycleProgress(Math.min(Math.max(cycleProgressForLighting, 0), 100));
    setCycleTime(cycleTime);
  }, [cycleProgressForLighting, cycleTime, setCycleProgress, setCycleTime]);

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
        {forcedPhase ? (
          <div>
            Light override: <span className="font-bold">{forcedPhase.name}</span>
          </div>
        ) : null}
        <div>
          Time left in {phaseData.phaseName}: <span className="font-bold">{formatTime(timeLeftInPhase)}</span>
        </div>
      </div>
    ),
    [phaseData.phaseName, dayDuration, forcedPhase, timeLeftInPhase],
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

  const handleLightPhaseSelection = useCallback((value: string) => {
    setLightPhaseSelection(value as LightPhaseSelection);
  }, []);

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
      <select
        value={lightPhaseSelection}
        onChange={(event) => handleLightPhaseSelection(event.target.value)}
        className="h-6 rounded border border-gold/40 bg-dark-wood/90 px-1 text-[10px] text-gold focus:outline-none"
        aria-label="Light phase override"
      >
        <option value="live">Light: Live</option>
        {PHASES.map((phase) => (
          <option key={phase.key} value={phase.key}>
            {phase.name}
          </option>
        ))}
      </select>
    </div>
  );
});

TickProgress.displayName = "TickProgress";
