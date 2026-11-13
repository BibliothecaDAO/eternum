import { useGame } from "@/hooks/context/game-context";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { buildingOutput } from "@/ui/shared/lib/building-output";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";
import { useEffect, useRef } from "react";

import { OPENING } from "./opening";
import { useOpeningLine } from "./use-opening";

/** How long a line stands over the map before it goes by itself: long enough to read two short sentences. */
export const OPENING_LINE_MS = 8_000;

/**
 * The one line a moment brings, over the map as a notice, the first time the account meets it: it goes by itself, or
 * sooner by Got it, and the next line met waits behind it.
 */
export const OpeningLine = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const line = useOpeningLine();
  const { setup } = useGame();
  const putAway = useRef(line?.putAway);
  useEffect(() => {
    putAway.current = line?.putAway;
  });
  const moment = line?.moment;
  useEffect(() => {
    if (!moment) return;
    const goes = setTimeout(() => putAway.current?.(), OPENING_LINE_MS);
    return () => clearTimeout(goes);
  }, [moment]);
  if (!line) return null;
  const knightsAnHour = buildingOutput(setup.store, realm, BuildingType.ResourceKnightT1, 0).base * 3600;
  return (
    <HudNotice
      icon={OPENING[line.moment].icon}
      line={OPENING_WORDS.lines[line.moment](knightsAnHour)}
      fix={{ label: OPENING_WORDS.gotIt, onClick: line.putAway }}
    />
  );
};
