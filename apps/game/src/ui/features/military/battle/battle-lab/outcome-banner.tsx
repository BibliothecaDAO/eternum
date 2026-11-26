import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { BATTLE_OUTCOME_WORDS } from "@/ui/design-system/kit/words";

export type BattleOutcome = "Victory" | "Defeat" | "Draw";

const COPY: Record<BattleOutcome, { label: string; tone: "good" | "bad" | "warn" }> = {
  Victory: { label: BATTLE_OUTCOME_WORDS.Victory, tone: "good" },
  Defeat: { label: BATTLE_OUTCOME_WORDS.Defeat, tone: "bad" },
  Draw: { label: BATTLE_OUTCOME_WORDS.Draw, tone: "warn" },
};

export const OutcomeBanner = ({ outcome }: { outcome: BattleOutcome }) => {
  const { label, tone } = COPY[outcome];
  return <HudNotice tone={tone} line={label} />;
};
