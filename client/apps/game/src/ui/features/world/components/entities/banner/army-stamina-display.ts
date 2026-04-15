export const resolveCommittedStaminaTextValue = ({
  stamina,
}: {
  stamina: { amount: bigint; updated_tick: bigint };
  projectedCurrent?: number;
}) => Number(stamina.amount);
