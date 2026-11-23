import { formatPercent } from "@bibliothecadao/types";

/** A modifier's bonus or malus as a signed percent ("+10%", "-5%"), or the word for none. */
const biomeBonusText = (bonus: number, none = "No Bonus"): string =>
  Math.round((bonus - 1) * 100) === 0 ? none : formatPercent(bonus - 1, { signed: true });

const ModifierChip = ({ modifier, none }: { modifier: number; none: string }) => {
  const text = biomeBonusText(modifier, none);
  if (text === none) return text;
  return <span className={`${modifier < 1 ? "text-hud-bad" : "text-hud-good"} text-hud-strong`}>{text}</span>;
};

export const formatBiomeBonus = (bonus: number) => <ModifierChip modifier={bonus} none="No Bonus" />;
