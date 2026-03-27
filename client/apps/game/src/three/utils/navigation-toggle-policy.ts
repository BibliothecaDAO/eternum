interface MapHexToggleCooldownDecisionInput {
  nowMs: number;
  cooldownUntilMs: number;
  cooldownMs: number;
}

interface MapHexToggleCooldownDecision {
  shouldBlockToggle: boolean;
  nextCooldownUntilMs: number;
}

export const resolveMapHexToggleCooldownDecision = (
  input: MapHexToggleCooldownDecisionInput,
): MapHexToggleCooldownDecision => {
  if (input.nowMs < input.cooldownUntilMs) {
    return {
      shouldBlockToggle: true,
      nextCooldownUntilMs: input.cooldownUntilMs,
    };
  }

  return {
    shouldBlockToggle: false,
    nextCooldownUntilMs: input.nowMs + Math.max(0, input.cooldownMs),
  };
};
