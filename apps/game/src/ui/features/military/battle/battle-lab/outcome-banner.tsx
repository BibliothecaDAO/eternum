import { HudNotice } from "@/ui/design-system/kit/hud-elements";

export type BattleOutcome = "Victory" | "Defeat" | "Draw";

const COPY: Record<BattleOutcome, { label: string; tone: "good" | "bad" | "warn" }> = {
  Victory: { label: "Victory — the enemy is wiped out", tone: "good" },
  Defeat: { label: "Defeat — your force is wiped out", tone: "bad" },
  Draw: { label: "Both armies survive — no decisive result", tone: "warn" },
};

export const OutcomeBanner = ({ outcome }: { outcome: BattleOutcome }) => {
  const { label, tone } = COPY[outcome];
  return <HudNotice tone={tone} line={label} />;
};
