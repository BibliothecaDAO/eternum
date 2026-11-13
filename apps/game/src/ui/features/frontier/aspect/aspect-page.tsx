import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudMeter, HudPage, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { configManager, HYPERSTRUCTURE_STAGES, type AspectRace, type AspectStanding } from "@bibliothecadao/eternum";
import { aspectName, formatExact, formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { useFrontierRealm } from "../frontier-home";
import { type AspectPagePlan, type OwnAspect, readAspectPage } from "./aspect-page-plan";

/** What the page reads: the race, the Triumphs, the bane bars, the members and the Deep's guards. */
const ASPECT_PAGE_MODELS = [
  "RaceRules",
  "RaceResult",
  "AspectHyperstructure",
  "TriumphDay",
  "AltarBar",
  "DeepRules",
  "HomeAspect",
  "RaceMember",
  "Structure",
  "DeepSite",
  "DeepGuard",
  "DeepArmy",
  "Guard",
  "ExplorerTroops",
] as const;

/** The game's Aspect page, read from its facts at the chain's clock; null in a game with no race. */
export const useAspectPage = (): AspectPagePlan | null => {
  const { setup } = useGame();
  const viewer = useAccountAddress();
  const now = useCurrentBlockTimestamp();
  const realm = useFrontierRealm();
  useNativeRevision(ASPECT_PAGE_MODELS);
  return readAspectPage(setup.store, configManager.getActiveGameId(), realm?.entity_id ?? null, viewer, now);
};

/**
 * The Aspect page (one job: how the four Aspects stand in the race, and what the player's own is doing): the four
 * hyperstructures ranked, each with its height and stage; then the player's Aspect, its Triumphs, its bane bar and its
 * members by Glory with the site each guards today.
 */
export const AspectPage = ({ plan, onClose }: { plan: AspectPagePlan; onClose: () => void }) => (
  <HudPage label={ASPECT_PAGE_WORDS.title} icon="hyperstructure" onClose={onClose} bodyClassName="gap-3">
    {plan.kind === "reading" ? (
      <span className="text-hud-label text-hud-muted">{ASPECT_PAGE_WORDS.reading}</span>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <Race race={plan.race} own={plan.own?.aspect ?? null} />
        {plan.own ? <YourAspect own={plan.own} /> : <Muted>{ASPECT_PAGE_WORDS.noAspect}</Muted>}
      </div>
    )}
  </HudPage>
);

/** The four hyperstructures, ranked, the player's own lit, and the age's winner once one finished. */
const Race = ({ race, own }: { race: AspectRace; own: number | null }) => (
  <section data-aspect-race className="flex flex-col gap-1">
    <Heading>{ASPECT_PAGE_WORDS.race}</Heading>
    {race.winner !== null && <Muted>{ASPECT_PAGE_WORDS.won(aspectName(race.winner))}</Muted>}
    {race.standings.map((standing) => (
      <StandingRow key={standing.aspect} standing={standing} race={race} own={standing.aspect === own} />
    ))}
  </section>
);

/** One Aspect's hyperstructure: its place, its name, its height against the finish and its stage. */
const StandingRow = ({ standing, race, own }: { standing: AspectStanding; race: AspectRace; own: boolean }) => (
  <HudRow
    lead={<span className="w-6 text-center text-hud-strong text-hud-ink">{formatExact(standing.rank)}</span>}
    title={aspectName(standing.aspect)}
    selected={own}
    detail={
      <span className="flex flex-col gap-0.5">
        <span>
          {standing.finished
            ? ASPECT_PAGE_WORDS.finished
            : ASPECT_PAGE_WORDS.stage(standing.stage, HYPERSTRUCTURE_STAGES)}{" "}
          · {ASPECT_PAGE_WORDS.height(standing.height, race.finishHeight)}
        </span>
        <HudMeter
          label={ASPECT_PAGE_WORDS.height(standing.height, race.finishHeight)}
          share={standing.height / race.finishHeight}
        />
      </span>
    }
  />
);

/** The player's Aspect: its Triumphs as they fall, its bane bar, and its members by Glory. */
const YourAspect = ({ own }: { own: OwnAspect }) => (
  <section data-aspect-own className="flex flex-col gap-2">
    <Heading>{ASPECT_PAGE_WORDS.yours(aspectName(own.aspect))}</Heading>
    <div data-aspect-triumphs className="flex flex-wrap items-center gap-1">
      <Muted>{ASPECT_PAGE_WORDS.triumphs}:</Muted>
      {own.triumphs.map(({ stage, day }) => (
        <HudChip key={stage} icons={["star"]} tone={day === null ? undefined : "good"}>
          {ASPECT_PAGE_WORDS.triumph[stage]} ·{" "}
          {day === null ? ASPECT_PAGE_WORDS.triumphAt(stage) : ASPECT_PAGE_WORDS.triumphOn(day)}
        </HudChip>
      ))}
    </div>
    {own.bar && (
      <div data-aspect-bane className="flex flex-col gap-0.5">
        <Muted>
          {ASPECT_PAGE_WORDS.baneBar}: {ASPECT_PAGE_WORDS.baneCharge(own.bar.charge, own.bar.threshold)}
        </Muted>
        <HudMeter
          label={ASPECT_PAGE_WORDS.baneBar}
          share={own.bar.threshold > 0 ? own.bar.charge / own.bar.threshold : 0}
        />
      </div>
    )}
    <Heading>{ASPECT_PAGE_WORDS.members}</Heading>
    <div data-aspect-members className="flex flex-col gap-1">
      {own.members.map((member) => (
        <HudRow
          key={String(member.home)}
          lead={<Icon name="realm" size={32} />}
          title={member.realm}
          selected={member.mine}
          detail={member.guards ? ASPECT_PAGE_WORDS.guards(member.guards) : undefined}
          trail={
            <HudChip icons={["crown"]} label={ASPECT_PAGE_WORDS.glory}>
              {formatShort(member.glory)}
            </HudChip>
          }
        />
      ))}
    </div>
  </section>
);

const Heading = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-strong text-hud-ink">{children}</span>
);
const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-hud-label text-hud-muted">{children}</span>
);
