import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useState } from "react";
import { Chip, TierBanner } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import { PersonGlyph } from "../glyphs";
import type { UpgradePlan, UpgradeStep } from "./upgrade-plan";
import { FrontierSheet } from "../frontier-sheet";

/**
 * Frontier's upgrade sheet (design §3.12, mockup 1), on a building or on the keep: its name with the marked plot's ×2,
 * the population it takes, the thing now and next as art with its tier banner and what each gives, and one Upgrade
 * button carrying the price. At the top tier the next side is gone and the button with it.
 */
export const UpgradeSheet = ({
  plan,
  upgrade,
  onClose,
}: {
  plan: UpgradePlan;
  upgrade: () => Promise<void>;
  onClose: () => void;
}) => {
  const [pending, setPending] = useState(false);
  const canUpgrade = !pending && plan.next !== null && plan.affordable;
  const send = async () => {
    setPending(true);
    try {
      await upgrade();
    } finally {
      setPending(false);
    }
  };
  return (
    <FrontierSheet label={plan.name} onClose={onClose} bodyClassName="gap-4">
      <header className="flex items-center gap-2">
        <h2 className="frontier-title">{plan.name}</h2>
        {plan.doubled && <DoubledBadge />}
        {plan.population !== undefined && (
          <span className="ml-auto">
            <Chip small label="Population" icon={<PersonGlyph />} value={formatAmount(plan.population)} />
          </span>
        )}
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <StepView step={plan.now} />
        {plan.next && (
          <>
            <ArrowGlyph />
            <StepView step={plan.next} next />
          </>
        )}
      </div>
      {plan.next && (
        <button
          type="button"
          disabled={!canUpgrade}
          onClick={() => void send()}
          className="frontier-primary flex items-center justify-center gap-3"
        >
          Upgrade
          {plan.price.map((cost) => (
            <Chip
              key={cost.resource}
              small
              tone="price"
              label="Costs"
              icon={<img src={`/images/resources/${cost.resource}.png`} alt="" />}
              value={formatAmount(cost.amount)}
            />
          ))}
        </button>
      )}
    </FrontierSheet>
  );
};

/** Now to next: a bold amber arrow. */
const ArrowGlyph = () => (
  <svg viewBox="0 0 40 28" className="h-7 w-10" aria-hidden>
    <path
      d="M4 14h26M22 5l10 9-10 9"
      fill="none"
      stroke="#f6ac1d"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** The ring's marked plot doubles what the building gives. */
const DoubledBadge = () => (
  <span
    aria-label="Doubled on this plot"
    className="rounded-full bg-[radial-gradient(circle_at_40%_35%,#ffd98a,#e39001)] px-2 py-0.5 font-[Lexend] text-sm font-extrabold text-[#1b1207] shadow-[0_0_10px_rgba(246,172,29,0.6)]"
  >
    ×2
  </span>
);

const StepView = ({ step, next = false }: { step: UpgradeStep; next?: boolean }) => (
  <span className="flex flex-col items-center gap-2">
    <img
      src={step.art}
      alt=""
      // The construction renders carry wide margins; drawn larger, they read at the mockup's size.
      className={cn("size-28 scale-125 object-contain", next && "drop-shadow-[0_0_18px_rgba(246,172,29,0.65)]")}
    />
    <TierBanner tier={step.tier} large />
    <Chip
      label={next ? "With it" : "Now"}
      tone={next ? "lit" : undefined}
      icon={<img src={step.gain.icon} alt="" />}
      value={`${formatAmount(step.gain.value)}${step.gain.perHour ? " /h" : ""}`}
    />
  </span>
);
