import { Check } from "lucide-react";
import type { SteeringJobType } from "@bibliothecadao/types";

import { STEERING_OPTIONS } from "../agent-dock-utils";

export const SteeringTab = ({
  isAutonomyEnabled,
  currentSteeringType,
  selectedSteering,
  onSelectSteering,
  onEnableAutonomy,
  onDisableAutonomy,
  onApplySteering,
  isEnabling,
  isDisabling,
  isApplying,
}: {
  isAutonomyEnabled: boolean;
  currentSteeringType: SteeringJobType | undefined;
  selectedSteering: SteeringJobType;
  onSelectSteering: (type: SteeringJobType) => void;
  onEnableAutonomy: () => void;
  onDisableAutonomy: () => void;
  onApplySteering: () => void;
  isEnabling: boolean;
  isDisabling: boolean;
  isApplying: boolean;
}) => {
  const selectedLabel = STEERING_OPTIONS.find((o) => o.id === selectedSteering)?.label ?? selectedSteering;
  const isSameAsCurrent = isAutonomyEnabled && currentSteeringType === selectedSteering;
  const isPending = isEnabling || isDisabling || isApplying;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/10 bg-black/35 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-gold/50">Steering Profile</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {STEERING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectSteering(option.id)}
              className={`relative rounded-xl border px-3 py-2.5 text-left ${
                selectedSteering === option.id
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-gold/10 bg-black/20 text-gold/70 hover:border-gold/25"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold">{option.label}</span>
                {currentSteeringType === option.id && isAutonomyEnabled && (
                  <Check className="h-3 w-3 text-gold/60" />
                )}
              </div>
              <div className="mt-1 line-clamp-2 text-xs">{option.summary}</div>
            </button>
          ))}
        </div>
      </div>

      {!isAutonomyEnabled ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onEnableAutonomy}
            disabled={isPending}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isEnabling ? "Enabling..." : `Enable Autonomy — ${selectedLabel}`}
          </button>
          <button
            type="button"
            onClick={onApplySteering}
            disabled={isPending}
            className="w-full text-center text-xs text-gold/45 hover:text-gold/70"
          >
            Or just update steering without enabling
          </button>
        </div>
      ) : isSameAsCurrent ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled
            className="w-full rounded-xl border border-gold/20 bg-black/35 px-4 py-3 text-sm text-gold/50"
          >
            Current Steering Active
          </button>
          <button
            type="button"
            onClick={onDisableAutonomy}
            disabled={isPending}
            className="w-full text-center text-xs text-red-300/60 hover:text-red-300"
          >
            {isDisabling ? "Disabling..." : "Disable autonomy"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onApplySteering}
            disabled={isPending}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isApplying ? "Applying..." : `Apply ${selectedLabel}`}
          </button>
          <button
            type="button"
            onClick={onDisableAutonomy}
            disabled={isPending}
            className="w-full text-center text-xs text-red-300/60 hover:text-red-300"
          >
            {isDisabling ? "Disabling..." : "Disable autonomy"}
          </button>
        </div>
      )}
    </div>
  );
};
