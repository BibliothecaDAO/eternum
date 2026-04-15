export const resolveDisplayedStaminaValue = ({
  stamina,
  projectedCurrent,
}: {
  stamina: { amount: bigint; updated_tick: bigint };
  projectedCurrent?: number;
}) =>
  projectedCurrent !== undefined && Number.isFinite(projectedCurrent)
    ? Math.round(projectedCurrent)
    : Number(stamina.amount);
