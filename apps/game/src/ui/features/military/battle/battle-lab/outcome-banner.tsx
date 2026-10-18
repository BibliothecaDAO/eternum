import { HudNotice } from "@/ui/design-system/kit/hud-elements";

export type BattleOutcome = "Victory" | "Defeat" | "Draw";

const COPY: Record<BattleOutcome, { label: string; tone: "good" | "bad" | "warn" }> = {
  Victory: { label: "Victory — the enemy is wiped out", tone: "good" },
  Defeat: { label: "Defeat — your force is wiped out", tone: "bad" },
  Draw: { label: "Both armies survive — no decisive result", tone: "warn" },
};

/** The battle's result, or both ends of it where the attacker's worst and best rolls land differently. */
export const OutcomeBanner = ({ outcomes }: { outcomes: { worst: BattleOutcome; best: BattleOutcome } }) => {
  const { label, tone } =
    outcomes.worst === outcomes.best
      ? COPY[outcomes.worst]
      : {
          label: `The dice decide — ${outcomes.worst} on the worst roll, ${outcomes.best} on the best`,
          tone: COPY.Draw.tone,
        };
  return <HudNotice tone={tone} line={label} />;
};
