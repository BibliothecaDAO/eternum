import { useUIStore } from "@/hooks/store/use-ui-store";
import { dayLightProgress } from "@/utils/cycle-progress";

export function applyLabDayLight(spent: string | null): void {
  if (spent === null) return;
  const share = Number(spent) / 100;
  if (!Number.isFinite(share)) throw new Error(`&day takes how much of the day is spent, 0 to 100, not ${spent}`);
  useUIStore.getState().setDebugCycleProgressOverride(dayLightProgress(share));
}
