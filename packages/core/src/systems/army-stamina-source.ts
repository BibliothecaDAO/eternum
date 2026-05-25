interface ArmyStaminaSnapshot {
  onChainStamina?: {
    amount: bigint;
    updatedTick: number;
  };
}

const getArmyStaminaUpdatedTick = (snapshot: ArmyStaminaSnapshot | null | undefined): number => {
  const updatedTick = snapshot?.onChainStamina?.updatedTick;
  return Number.isFinite(updatedTick) ? Number(updatedTick) : 0;
};

export const resolveFreshestArmyStaminaSource = (input: {
  liveSnapshot?: ArmyStaminaSnapshot | undefined;
  enhancedSnapshot?: ArmyStaminaSnapshot | undefined;
}): "live" | "enhanced" | undefined => {
  if (!input.liveSnapshot && !input.enhancedSnapshot) {
    return undefined;
  }

  if (!input.liveSnapshot) {
    return "enhanced";
  }

  if (!input.enhancedSnapshot) {
    return "live";
  }

  return getArmyStaminaUpdatedTick(input.liveSnapshot) > getArmyStaminaUpdatedTick(input.enhancedSnapshot)
    ? "live"
    : "enhanced";
};
