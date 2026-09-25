import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { leave } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { Pop } from "@/ui/motion/pop";
import { configManager, Position } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type useExpeditionRules, useGoToFrontierPlace } from "../frontier-home";
import { pointAtMuster } from "./guide-pointer";
import { canShowPlace, type GuideFacts, type GuidePlace, nextGuideStep } from "./guide-script";
import { useGuideSeen } from "./guide-seen";
import { useGuideFacts } from "./use-guide-facts";

const PORTRAIT = { neutral: "/images/guides/ysolde-neutral.webp", pleased: "/images/guides/ysolde-pleased.webp" };
/** The portrait leads the line in by this much, so she arrives before she speaks. */
const LINE_DELAY_MS = 60;

/**
 * Ysolde of the Fox, speaking one line at a time in the thumb zone. Never a modal: the map stays live around her.
 * A line the player answers by playing earns her pleased face on the next one; "Show me" takes the player to the place
 * a line names, "Next" dismisses it and "Skip" ends the guide.
 */
export const FrontierGuide = ({
  rules,
  realm,
}: {
  rules: NonNullable<ReturnType<typeof useExpeditionRules>>;
  realm: NativeRows["Structure"];
}) => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  const facts = useGuideFacts(rules, realm);
  const { seen, markSeen, skipAll } = useGuideSeen(configManager.getActiveGameId(), player);
  const step = player ? nextGuideStep(facts, seen) : null;
  const pleasedFor = usePleasedAfterPlay(step?.id ?? null, seen, markSeen);
  const showMeFor = useShowMe(realm);
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {step && (
        <motion.div key={step.id} exit={leave(reduced)} className="pointer-events-none relative pt-24 lg:pt-36">
          <GuideCard
            line={step.line}
            mood={step.mood ?? (pleasedFor === step.id ? "pleased" : "neutral")}
            onShowMe={showMeFor(step.place, facts)}
            onNext={() => markSeen([step.id])}
            onSkip={skipAll}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Ysolde standing on the card's top-left edge, her waist fade over it, arriving just before the line. */
const GuideCard = ({
  line,
  mood,
  onShowMe,
  onNext,
  onSkip,
}: {
  line: string;
  mood: keyof typeof PORTRAIT;
  onShowMe: (() => void) | null;
  onNext: () => void;
  onSkip: () => void;
}) => (
  <>
    <Pop delayMs={LINE_DELAY_MS}>
      <aside
        aria-label="Ysolde"
        aria-live="polite"
        className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flow-root rounded-xl p-3")}
      >
        {/* Her fade reaches just inside the card: the name steps past it and the line runs full width. */}
        <span aria-hidden className="float-left h-2 w-[108px] lg:w-[156px]" />
        <h2 className="text-base font-semibold text-gold">Ysolde of the Fox</h2>
        <p className="mt-1 text-base leading-snug text-gold/90">{line}</p>
        <div className="clear-both flex flex-wrap gap-2 pt-2">
          {onShowMe && (
            <GuideButton primary onClick={onShowMe}>
              Show me
            </GuideButton>
          )}
          <GuideButton primary={!onShowMe} onClick={onNext}>
            Next
          </GuideButton>
          <GuideButton onClick={onSkip}>Skip the guide</GuideButton>
        </div>
      </aside>
    </Pop>
    <Pop className="absolute left-2 top-0 origin-bottom-left">
      <img src={PORTRAIT[mood]} alt="" className="h-28 w-28 lg:h-40 lg:w-40" />
    </Pop>
  </>
);

const GuideButton = ({
  primary = false,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "min-h-11 rounded-lg px-4 lg:min-h-9",
      primary ? "bg-gold font-semibold text-dark-brown" : "border border-gold/30 text-gold/80",
    )}
  >
    {children}
  </button>
);

/**
 * Marks each line seen once the next one replaces it. A line still unseen when it goes was answered by play, since
 * "Next" marks its line first, so the line after it is the one Ysolde greets pleased.
 */
const usePleasedAfterPlay = (
  stepId: string | null,
  seen: ReadonlySet<string>,
  markSeen: (ids: readonly string[]) => void,
): string | null => {
  const shown = useRef<string | null>(null);
  const [pleasedFor, setPleasedFor] = useState<string | null>(null);
  useEffect(() => {
    const previous = shown.current;
    shown.current = stepId;
    if (!previous || previous === stepId) return;
    setPleasedFor(seen.has(previous) ? null : stepId);
    markSeen([previous]);
  }, [markSeen, seen, stepId]);
  return pleasedFor;
};

/**
 * "Show me" for a line's place, or null when it has nowhere to go: the realm board for the realm, a sweep over the
 * muster card, the camera on the camp.
 */
const useShowMe = (realm: NativeRows["Structure"]) => {
  const goToPlace = useGoToFrontierPlace(realm);
  const navigateToMapView = useNavigateToMapView();
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const show = (place: GuidePlace, camp: GuideFacts["camp"]) => {
    if (place === "realm") goToPlace(false);
    if (place === "muster") pointAtMuster();
    if (place === "camp" && camp) {
      navigateToMapView(Position.fromContract(camp));
      setSelectedHex({ col: camp.x, row: camp.y });
    }
  };
  return (place: GuidePlace | undefined, facts: GuideFacts): (() => void) | null =>
    canShowPlace(place, facts) ? () => show(place, facts.camp) : null;
};
