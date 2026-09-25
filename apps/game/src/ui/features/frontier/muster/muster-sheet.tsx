import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { formatAmount } from "../frontier-format";
import { Chip, YieldChip } from "../frontier-chips";
import { BoltGlyph, SlotBanner, SwordGlyph } from "../glyphs";
import {
  type MusterStack,
  musterArmy,
  musterDirection,
  musterMaximum,
  previewMuster,
  readMusterPlan,
} from "./muster-plan";

const MUSTER_MODELS = ["ArmySlot", "ResourceBalance", "ResourceProduction", "Structure", "TileOccupancy"] as const;
const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Frontier's muster (design §3.12, mockup 4): the troops the realm holds as a portrait whose ring fills as the count
 * is dragged, strength, what each reveal sends home and the starting bar as icon chips, the day's slots as banners,
 * and one Muster button. No words beyond the title and the verb; everything else is art, icons and numbers.
 */
export const MusterSheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const armiesTick = useCurrentArmiesTick();
  const revision = useNativeRevision(MUSTER_MODELS);
  const plan = useMemo(
    () => readMusterPlan(setup.store, realm, defaultTick),
    [defaultTick, realm, revision, setup.store],
  );
  const [chosen, setChosen] = useState(0);
  const stack = plan?.stacks[chosen] ?? plan?.stacks[0];
  const [count, setCount] = useState(0);
  const direction = useMusterDirection(realm);
  const [pending, setPending] = useState(false);

  // The sheet opens, or a new stack is chosen, at the most the realm can field. Keyed on the stack's identity: its
  // object is rebuilt on every fact revision, which must not reset a count being dragged.
  useEffect(() => {
    if (stack) setCount(musterMaximum(stack));
  }, [stack?.type, stack?.tier]);

  const maximum = stack ? musterMaximum(stack) : 0;
  const preview = plan && stack ? previewMuster(setup.store, realm.game_id, plan, stack, count, armiesTick) : null;
  const canMuster = !pending && plan?.next != null && direction !== null && preview !== null && preview.count > 0;

  const muster = async () => {
    if (!stack || direction === null || !preview) return;
    setPending(true);
    try {
      await musterArmy(requireActiveGameClient().actions, realm, stack, preview.count, direction);
      onClose();
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The army could not muster."));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-label="Muster"
      data-frontier-sheet
      // A bottom sheet over the dock on a phone held upright; at the foot of the screen otherwise.
      className={cn(
        "frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans",
        "landscape:inset-x-auto landscape:bottom-4 landscape:left-1/2 landscape:w-[min(520px,60vw)] landscape:-translate-x-1/2",
      )}
    >
      {/* The sheet's handle closes it, as a swipe down would. */}
      <button type="button" aria-label="Close" onClick={onClose} className="-mt-2 flex h-6 justify-center">
        <span className="frontier-handle mt-1" />
      </button>
      <header className="flex items-center justify-between">
        <h2 className="frontier-title">Muster</h2>
        {plan && <SlotBanners used={plan.slots.used} allowed={plan.slots.allowed} />}
      </header>
      {plan && plan.stacks.length > 1 && <StackPicker stacks={plan.stacks} chosen={chosen} onChoose={setChosen} />}
      <PortraitRing stack={stack} share={maximum > 0 ? count / maximum : 0} />
      <p className="frontier-hero text-center tabular-nums" aria-label="Troops">
        {stack ? formatAmount(preview?.count ?? 0) : "—"}
      </p>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Troops</span>
        <input
          type="range"
          min={0}
          max={maximum}
          value={Math.min(count, maximum)}
          disabled={!stack}
          onChange={(event) => setCount(Number(event.target.value))}
          style={{ background: sliderTrack(maximum > 0 ? Math.min(count, maximum) / maximum : 0) }}
          className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[radial-gradient(circle_at_35%_35%,#fbe3a3,#e39001)] [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[radial-gradient(circle_at_35%_35%,#fbe3a3,#e39001)] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(227,144,1,0.6)]"
        />
        <span className="frontier-scale-end flex justify-between tabular-nums">
          <span>0</span>
          <span>{formatAmount(maximum)}</span>
        </span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Chip label="Strength" icon={<SwordGlyph />} value={preview ? formatAmount(preview.strength) : "—"} />
        <YieldChip scaled={preview?.revealYield} />
        <Chip
          label="Starting stamina"
          icon={<BoltGlyph />}
          value={preview?.stamina ? formatAmount(preview.stamina.amount) : "—"}
        />
      </div>
      <button type="button" disabled={!canMuster} onClick={() => void muster()} className="frontier-primary">
        Muster
      </button>
    </section>
  );
};

/** Where the new army steps out: the first free hex around the realm, from the map's own tiles. */
const useMusterDirection = (realm: NativeRows["Structure"]) => {
  const { setup } = useGame();
  const home = structureMapPosition(setup.store, realm);
  const neighbors = useMemo(() => getNeighborHexes(home.x, home.y), [home.x, home.y]);
  const tiles = useWorldSpatialTiles(neighbors);
  return musterDirection(setup.store, realm, (hex) => {
    const tile = tiles.find(({ hexCoords }) => hexCoords.col === hex.col && hexCoords.row === hex.row);
    return tile ? Number(tile.occupierId) : undefined;
  });
};

/** The day's army slots as banners: a filled banner holds an army, an empty one waits for this muster. */
const SlotBanners = ({ used, allowed }: { used: number; allowed: number }) => (
  <span className="flex gap-1.5" aria-label={`${used} of ${allowed} armies today`}>
    {Array.from({ length: allowed }, (_, index) => (
      <SlotBanner key={index} used={index < used} />
    ))}
  </span>
);

/** The slider's track: amber up to the thumb, the faint gold of the unfilled ring beyond it. */
const sliderTrack = (share: number) =>
  `linear-gradient(to right, #e39001 ${share * 100}%, rgba(223, 170, 84, 0.15) ${share * 100}%)`;

/** The army's diorama: its troops on their hex base, the art an army card shows. */
const troopArt = (stack: MusterStack) => `/images/armies/${stack.type.toLowerCase()}${stack.tier}.png`;

/** The troops as their portrait, inside a ring that fills with the share of the stack being mustered. */
const PortraitRing = ({ stack, share }: { stack: MusterStack | undefined; share: number }) => (
  <div className="relative mx-auto size-48 landscape:size-40">
    <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="muster-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7c35a" />
          <stop offset="100%" stopColor="#e39001" />
        </linearGradient>
        <filter id="muster-ring-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="rgba(223,170,84,0.15)" strokeWidth="5" />
      <circle
        cx="50"
        cy="50"
        r={RING_RADIUS}
        fill="none"
        stroke="url(#muster-ring)"
        filter="url(#muster-ring-glow)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - Math.min(1, Math.max(0, share)))}
        className="transition-[stroke-dashoffset] duration-150"
      />
    </svg>
    <div className="absolute inset-5 overflow-hidden rounded-full bg-black/60">
      {stack && <img src={troopArt(stack)} alt="" className="size-full object-cover" />}
    </div>
  </div>
);

/** Several stacks at the realm: their portraits in a row, the chosen one ringed. */
const StackPicker = ({
  stacks,
  chosen,
  onChoose,
}: {
  stacks: MusterStack[];
  chosen: number;
  onChoose: (index: number) => void;
}) => (
  <div className="flex justify-center gap-2" role="radiogroup" aria-label="Troops">
    {stacks.map((stack, index) => (
      <button
        key={`${stack.type}-${stack.tier}`}
        type="button"
        role="radio"
        aria-checked={index === chosen}
        aria-label={`${stack.type} ${stack.tier}`}
        onClick={() => onChoose(index)}
        className={cn(
          "size-12 overflow-hidden rounded-full border-2 bg-black/50",
          index === chosen ? "border-gold" : "border-gold/20",
        )}
      >
        <img src={troopArt(stack)} alt="" className="size-full object-cover" />
      </button>
    ))}
  </div>
);
