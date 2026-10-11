import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { leave } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { Pop } from "@/ui/motion/pop";
import { configManager, Position } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";

import { type useExpeditionRules, useGoToFrontierPlace } from "../frontier-home";
import { GuideCard } from "./guide-card";
import { pointAtDeploy } from "./guide-pointer";
import {
  canShowPlace,
  type GuideFacts,
  type GuideHost,
  type GuidePlace,
  isGuideOn,
  nextGuideStep,
} from "./guide-script";
import { useGuideSeen } from "./guide-seen";
import { GuideThread } from "./guide-thread";
import { useGuideFacts } from "./use-guide-facts";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

type Guide = {
  realm: NativeRows["Structure"];
  facts: GuideFacts;
  seen: ReadonlySet<string>;
  markSeen: (ids: readonly string[]) => void;
  skipAll: () => void;
  replay: () => void;
};

const GuideContext = createContext<Guide | null>(null);

/**
 * The guide over the game: the facts its lines answer and the lines this viewer has seen, read once for every slot.
 * It speaks only to a player in their own realm; a visit or a spectator hears nothing.
 */
export const GuideProvider = ({
  rules,
  realm,
  children,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  children: ReactNode;
}) => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  const facts = useGuideFacts(rules, realm);
  const { seen, markSeen, skipAll, replay } = useGuideSeen(configManager.getActiveGameId(), player);
  const guide = player && realm ? { realm, facts, seen, markSeen, skipAll, replay } : null;
  return <GuideContext.Provider value={guide}>{children}</GuideContext.Provider>;
};

/**
 * Where a line speaks: the HUD's foot, or a card that hosts its own line and tells the fact behind it (the forecast
 * on a site card, the season's end).
 */
export const GuideSlot = ({ host, facts }: { host: GuideHost; facts?: Partial<GuideFacts> }) => {
  const guide = useContext(GuideContext);
  return guide ? <GuideSpeaker guide={guide} host={host} facts={{ ...guide.facts, ...facts }} /> : null;
};

/** The Menu's Guide row: on while any line is still to come; off marks every line seen, on starts it over. */
export const useGuideSwitch = (): { on: boolean; toggle: () => void } | null => {
  const guide = useContext(GuideContext);
  if (!guide) return null;
  const on = isGuideOn(guide.seen);
  return { on, toggle: on ? guide.skipAll : guide.replay };
};

const GuideSpeaker = ({ guide, host, facts }: { guide: Guide; host: GuideHost; facts: GuideFacts }) => {
  const step = nextGuideStep(facts, guide.seen, host);
  useMarkAnsweredSeen(step?.id ?? null, guide.markSeen);
  const showMe = useShowMe(guide.realm);
  const card = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      {step && (
        <motion.div key={step.id} exit={leave(reduced)} className="pointer-events-none">
          <Pop>
            <GuideCard
              ref={card}
              mark={step.mark}
              line={step.line(facts)}
              onShowMe={canShowPlace(step.place, facts) ? () => showMe(step.place!, facts.camp) : undefined}
              onNext={() => guide.markSeen([step.id])}
            />
          </Pop>
          {step.target && <GuideThread from={card} target={step.target} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Marks each line seen once the next one replaces it: a line still unseen when it goes was answered by play, since
 * Next marks its line first.
 */
const useMarkAnsweredSeen = (stepId: string | null, markSeen: (ids: readonly string[]) => void) => {
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const previous = shown.current;
    shown.current = stepId;
    if (previous && previous !== stepId) markSeen([previous]);
  }, [markSeen, stepId]);
};

/** Show me for a line's place: the realm board, a sweep over the first open army slot, the camera on the camp. */
const useShowMe = (realm: NativeRows["Structure"]) => {
  const goToPlace = useGoToFrontierPlace(realm);
  const navigateToMapView = useNavigateToMapView();
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  return (place: GuidePlace, camp: GuideFacts["camp"]) => {
    if (place === "realm") goToPlace(false);
    if (place === "deploy") pointAtDeploy();
    if (place === "camp" && camp) {
      navigateToMapView(Position.fromContract(camp));
      setSelectedHex({ col: camp.x, row: camp.y });
    }
  };
};
