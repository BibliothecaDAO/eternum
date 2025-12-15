import { BlitzOnboarding, SettleRealm, StepOne } from "@/ui/features/progression";
import { getIsBlitz } from "@bibliothecadao/eternum";
import { env } from "../../../../env";

interface SettlementPanelProps {
  onEnterGame: () => void;
}

export const SettlementPanel = ({ onEnterGame }: SettlementPanelProps) => {
  const isBlitz = getIsBlitz();
  const isLocal = env.VITE_PUBLIC_CHAIN === "local";

  // For blitz mode, show BlitzOnboarding
  if (isBlitz) {
    return <BlitzOnboarding />;
  }

  // For local chain, show StepOne
  if (isLocal) {
    return <StepOne />;
  }

  // For mainnet/sepolia, show realm settlement
  return <SettleRealm onPrevious={() => {}} />;
};
