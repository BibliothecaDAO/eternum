export const formatBiomeBonus = (bonus: number) => {
  const percentage = ((bonus - 1) * 100).toFixed(0);
  if (percentage === "0") return "No bonus";
  return percentage.startsWith("-") ? (
    <span className="text-order-giants">{percentage}%</span>
  ) : (
    <span className="text-order-brilliance">+{percentage}%</span>
  );
};

export const getStaminaDisplay = (
  currentStamina: number,
  newStamina: number,
  isWinner: boolean,
  staminaBonus: number,
) => {
  return (
    <div className="text-gold/80">
      <div className="text-sm font-medium mb-1">Stamina</div>
      <div className="text-xl font-bold flex items-baseline">
        {Math.max(0, newStamina)}
        <span className="text-xs ml-2 text-gold/50">/ {currentStamina}</span>
        {isWinner && <span className="text-xs ml-2 text-green-400">(+{staminaBonus})</span>}
      </div>
    </div>
  );
};
