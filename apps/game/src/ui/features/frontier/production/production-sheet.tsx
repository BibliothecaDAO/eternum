import { formatAmount, formatRate } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { HUD_TONE, type Tone } from "@/ui/design-system/kit/tone";
import { BUILD, DEPLOY, FULL, LABOR, PRODUCTION, REALM, TROOPS, WHEAT } from "@/ui/design-system/kit/words";

import { FullIn } from "../full-in";

/** The three stores by their icons, each with the word written beside it: a store without a word does not compile. */
const STORE_WORDS = { wheat: WHEAT, labor: LABOR, troops: TROOPS } as const satisfies Partial<
  Record<IconMeaning, string>
>;

/** Where a full store is spent: labor on the realm board, wheat and troops by Deploy. */
export type SpentAt = "realm" | "deploy";

/** One store's row: what it makes an hour (with the side marks that shape it), what it holds against its limit. */
export type ProductionLine = {
  icon: keyof typeof STORE_WORDS;
  perHour: number | undefined;
  sides?: readonly IconMeaning[];
  held: number | undefined;
  limit: number | undefined;
  tone: Tone;
  /** Seconds until it is full; 0 when full, undefined while the limit or the rate is unknown. */
  fullIn: number | undefined;
  /** No building makes it: Build is the way. */
  noBuilding: boolean;
  spentAt: SpentAt;
};

/**
 * Production (wireframe 03): three rows, wheat, labor and troops, each named in words beside its icon: the rate an
 * hour with its side marks, what each holds against its limit, and when it is full, in hours, never days. A Full row says so and points to where that store is
 * spent; a store no building makes offers Build. No input rows.
 */
export const ProductionSheet = ({
  lines,
  onSpend,
  onBuild,
  onClose,
}: {
  lines: readonly ProductionLine[];
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={PRODUCTION} onClose={onClose}>
    {lines.map((line) => (
      <Row key={line.icon} line={line} onSpend={onSpend} onBuild={onBuild} />
    ))}
  </HudSheet>
);

const Row = ({
  line,
  onSpend,
  onBuild,
}: {
  line: ProductionLine;
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
}) => {
  const full = line.limit !== undefined && line.held !== undefined && line.held >= line.limit;
  const word = STORE_WORDS[line.icon];
  return (
    <div className="flex items-center gap-2 border-b border-hud-divider py-1.5">
      <Icon name={line.icon} size={28} />
      <span className="flex w-24 shrink-0 flex-col">
        <span className="text-hud-label capitalize text-hud-muted">{word}</span>
        <span className={`flex items-center gap-1 tabular-nums ${full ? "text-hud-bad" : ""}`}>
          {full ? formatRate(0) : formatRate(line.perHour === undefined ? undefined : line.perHour / 3600)}
          {line.sides?.map((side, index) => (
            <Icon key={index} name={side} size={18} />
          ))}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {/* The kit's amount rule, as on the strip: a phone's row has no room for two exact five-digit amounts. A full
            store holds its limit, so its row says the one number beside Full. */}
        <span className="whitespace-nowrap text-hud-label tabular-nums">
          {formatAmount(line.held)}
          {line.limit !== undefined && !full && ` / ${formatAmount(line.limit)}`}
        </span>
        {line.limit !== undefined && (
          <HudMeter
            share={line.held === undefined || line.limit <= 0 ? 0 : line.held / line.limit}
            tone={HUD_TONE[line.tone]}
            label={word}
          />
        )}
      </span>
      {full ? (
        <>
          <HudChip tone="bad">{FULL}</HudChip>
          <HudButton
            kind="secondary"
            icon={line.spentAt === "realm" ? "realm" : undefined}
            onClick={() => onSpend(line.spentAt)}
          >
            {line.spentAt === "realm" ? REALM : DEPLOY}
          </HudButton>
        </>
      ) : line.noBuilding ? (
        <HudButton kind="secondary" onClick={onBuild}>
          {BUILD}
        </HudButton>
      ) : (
        line.fullIn !== undefined && <FullIn seconds={line.fullIn} />
      )}
    </div>
  );
};
