import "./season-recap.css";
import "./festival.css";

import { heldRealmForHome } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount, formatExact, LORDS } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { homeIcon } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";
import { AppTicket } from "@/ui/design-system/kit/app-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { FESTIVAL_WORDS, RECAP_WORDS } from "@/ui/design-system/kit/words";
import { campaignMarkOf, readCampaignHome, type CampaignMark } from "@/ui/features/frontier/value/campaign-home";
import { HomeArt } from "@/ui/shared/components/home-art";

import { DiyaRow, FireworkSky, Rangoli } from "./festival-art";

/**
 * The player's home this season, as the Realm sheet tells it (use-realm-labor.ts): a campaign's (Devcon's), a held
 * Realm's, or a free one. A campaign home's owner is the one a Season 1 ticket waits for.
 */
export type SeasonHome = { kind: "campaign"; mark: CampaignMark } | { kind: "realm"; level: number } | { kind: "free" };

/** The player's realm's home, read again as its facts change; null before the realm is known. */
export const useSeasonHome = (realm: NativeRows["Structure"] | null): SeasonHome | null => {
  const { setup } = useGame();
  useNativeRevision(["CampaignHome", "SettledRealm"]);
  if (!realm) return null;
  const mark = campaignMarkOf(readCampaignHome(setup.store, realm), realm.base.level);
  if (mark) return { kind: "campaign", mark };
  const held = heldRealmForHome(setup.store, { gameId: realm.game_id, entityId: realm.entity_id });
  return held === null ? { kind: "free" } : { kind: "realm", level: realm.base.level };
};

/** The Season 1 ticket's realm: Devcon's, as the owner chose to reuse it. */
const TICKET_REALM = homeIcon("devcon", 3);

/**
 * The greeting that opens the season's end, before the deck: thanks and the festival, the player's place with their
 * home, and for a Devcon realm's owner the Season 1 ticket (else, see you in Season 1), under the fireworks. Its one
 * step opens the deck. Like the recap over the HUD, it is drawn at the body's end, out of the HUD's zoom.
 */
export const SeasonGreeting = ({
  cut,
  season,
  home,
  rank,
  field,
  prize,
  frame,
  step,
}: {
  cut: "wide" | "tall";
  /** "Season 0 · Ended 6 Nov". */
  season: string;
  home: SeasonHome;
  rank: number;
  field: number;
  prize: number | undefined;
  /** Holds the fireworks at that second (the lab's stills). */
  frame?: number;
  /** See my season: the deck. */
  step: ReactNode;
}) => {
  const ticket = home.kind === "campaign";
  return createPortal(
    <section className="festival-cover" data-surface="shell" data-cut={cut} aria-label={FESTIVAL_WORDS.thanks}>
      <img className="season-recap__painting" alt="" {...paintingSources("season-citadel")} sizes="100vw" />
      <FireworkSky className="festival-cover__sky" frame={frame} />
      <div className="festival-card" data-ticket={ticket ? "held" : "none"}>
        <Rangoli size={cut === "tall" ? 360 : 520} className="festival-card__rangoli" />
        <div className="festival-card__words">
          <p className="text-app-label text-app-gold">{season}</p>
          <h1 className={cut === "tall" ? "text-app-title text-app-ink" : "text-app-display text-app-ink"}>
            {FESTIVAL_WORDS.thanks}
          </h1>
          <p className="festival-greeting">{FESTIVAL_WORDS.enjoy}</p>
          <div className="festival-result">
            <SeasonHomeArt home={home} size={cut === "tall" ? 56 : 88} />
            <b className="festival-result__rank">#{formatAmount(rank)}</b>
            <span className="festival-result__of">
              {RECAP_WORDS.ofRealms(formatAmount(field))}
              {prize !== undefined && (
                <span className="festival-result__prize">
                  <Icon name="lords" size={24} />
                  {`${RECAP_WORDS.prize} · ${formatExact(prize)} ${LORDS}`}
                </span>
              )}
            </span>
          </div>
          {!ticket && <p className="festival-card__see-you">{FESTIVAL_WORDS.seeYou}</p>}
        </div>
        {ticket && <SeasonOneTicket />}
        <span className="festival-card__diyas">
          <DiyaRow count={cut === "tall" ? 5 : 9} size={cut === "tall" ? 40 : 52} />
        </span>
      </div>
      <div className="festival-cover__steps">{step}</div>
    </section>,
    document.body,
  );
};

/** The home's picture as the Realm sheet draws it: a campaign's painting on its tier, a Realm's, a free home's. */
const SeasonHomeArt = ({ home, size }: { home: SeasonHome; size: number }) => {
  switch (home.kind) {
    case "campaign":
      return <HomeArt icon={home.mark.icon} size={size} tier={home.mark.golden ? "golden" : "regular"} />;
    case "realm":
      return <HomeArt icon={homeIcon("realm", home.level)} size={size} />;
    case "free":
      return <HomeArt icon="realm" size={size} tier="free" />;
  }
};

/**
 * The owner's promise to a Devcon realm's owner, said whole: who it is for, that they get a special Season 1 ticket,
 * the ticket itself with its realm, and that it comes to this account with nothing to do.
 */
const SeasonOneTicket = () => (
  <section className="festival-gift" aria-label={FESTIVAL_WORDS.ticketTitle}>
    <p className="festival-gift__for">{FESTIVAL_WORDS.ticketFor}</p>
    <h2 className="festival-gift__title">{FESTIVAL_WORDS.ticketTitle}</h2>
    <div className="festival-gift__ticket">
      <AppTicket
        face="opened"
        art={<Icon name={TICKET_REALM} size={128} />}
        line={FESTIVAL_WORDS.ticketLine}
        stub={FESTIVAL_WORDS.ticketStub}
      />
    </div>
    <p className="festival-gift__how">{FESTIVAL_WORDS.ticketHow}</p>
  </section>
);
