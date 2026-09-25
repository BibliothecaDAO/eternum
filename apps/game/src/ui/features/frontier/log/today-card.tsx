import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { Eye, TreasureChest } from "@/ui/design-system/atoms/game-icons";
import { absoluteEpoch } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { Chip } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import type { useExpeditionRules } from "../frontier-home";
import { FlagGlyph } from "../glyphs";
import { totalToday } from "./today-totals";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/**
 * The top of Frontier's log: the player's day in icon rows, from their own stories since the day began. Reveals,
 * sites cleared and chests opened as counts; the Essence and labor they sent home as amounts.
 */
export const TodayCard = ({ rules }: { rules: ExpeditionRules }) => {
  const player = useAccountStore((state) => state.account?.address ?? null);
  const now = useNowSeconds();
  const { data: stories } = useStoryEvents(350);
  if (!player) return null;
  const start = absoluteEpoch(rules, now) * rules.epochSeconds;
  const totals = totalToday(stories, player, { startMs: start * 1_000, endMs: (start + rules.epochSeconds) * 1_000 });
  return (
    <section aria-label="Today" className="frontier-card mx-2 mt-2 grid grid-cols-3 gap-2 p-3 font-sans">
      <Chip small label="Reveals" icon={<Eye />} value={formatAmount(totals.reveals)} />
      <Chip small label="Sites cleared" icon={<FlagGlyph />} value={formatAmount(totals.sitesCleared)} />
      <Chip small label="Chests" icon={<TreasureChest />} value={formatAmount(totals.chests)} />
      <Chip
        small
        label="Essence"
        icon={<img src={`/images/resources/${ResourcesIds.Essence}.png`} alt="" />}
        value={`+${formatAmount(totals.essence)}`}
      />
      <Chip
        small
        label="Labor"
        icon={<img src={`/images/resources/${ResourcesIds.Labor}.png`} alt="" />}
        value={`+${formatAmount(totals.labor)}`}
      />
    </section>
  );
};
