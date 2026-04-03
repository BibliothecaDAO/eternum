import { getWorldKey } from "@/hooks/use-world-availability";
import type { DashboardEntryIntent, DashboardEntryIntentAction } from "@/hooks/store/use-dashboard-entry-intent-store";
import type { WorldSelectionInput } from "@/runtime/world";

interface BuildDashboardIntentOptions {
  action: DashboardEntryIntentAction;
  world: WorldSelectionInput;
  eternumEntryIntent?: "play" | "settle";
  numHyperstructuresLeft?: number;
}

export const buildDashboardIntent = ({
  action,
  world,
  eternumEntryIntent,
  numHyperstructuresLeft,
}: BuildDashboardIntentOptions): DashboardEntryIntent => {
  const worldKey = getWorldKey({ name: world.name, chain: world.chain });

  return {
    id: `${action}:${worldKey}:${Date.now()}`,
    action,
    world: {
      name: world.name,
      chain: world.chain,
      worldAddress: world.worldAddress,
      worldKey,
    },
    requestedAt: Date.now(),
    eternumEntryIntent,
    numHyperstructuresLeft,
  };
};

export const matchesDashboardIntent = (
  intent: DashboardEntryIntent | null | undefined,
  {
    action,
    worldKey,
  }: {
    action?: DashboardEntryIntentAction;
    worldKey?: string;
  },
) => {
  if (!intent) {
    return false;
  }

  if (action && intent.action !== action) {
    return false;
  }

  if (worldKey && intent.world.worldKey !== worldKey) {
    return false;
  }

  return true;
};

export const canResumeDashboardIntent = ({
  intent,
  hasAccount,
}: {
  intent: DashboardEntryIntent | null | undefined;
  hasAccount: boolean;
}) => {
  if (!intent || !hasAccount) {
    return false;
  }

  return true;
};
