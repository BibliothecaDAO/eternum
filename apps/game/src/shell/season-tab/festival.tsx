import "./season-recap.css";
import "./festival.css";

import { formatAmount, formatExact, LORDS } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { homeIcon } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";
import { AppTicket } from "@/ui/design-system/kit/app-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { FESTIVAL_WORDS, RECAP_WORDS } from "@/ui/design-system/kit/words";
import type { CampaignMark } from "@/ui/features/frontier/value/campaign-home";
import { HomeArt } from "@/ui/shared/components/home-art";

import { DiyaRow, FireworkSky, Rangoli } from "./festival-art";

/** The Season 1 ticket's realm: Devcon's, as the owner chose to reuse it. */
const TICKET_REALM = homeIcon("devcon", 3);

/**
 * The greeting that opens a Devcon realm's owner's season end, before the deck: thanks and the festival, their place
 * with their Devcon home, and their Season 1 ticket, under the fireworks. Its one step opens the deck. Like the recap over the HUD, it is drawn at the body's end, out of the HUD's zoom.
 */
export const SeasonGreeting = ({
  cut,
  season,
  mark,
  rank,
  field,
  prize,
  frame,
  step,
}: {
  cut: "wide" | "tall";
  /** "Season 0 · Ended 6 Nov". */
  season: string;
  /** The player's Devcon home, regular or golden (useCampaignMark). */
  mark: CampaignMark;
  rank: number;
  field: number;
  prize: number | undefined;
  /** Holds the fireworks at that second (the lab's stills). */
  frame?: number;
  /** See my season: the deck. */
  step: ReactNode;
}) => {
  return createPortal(
    <section className="festival-cover" data-surface="shell" data-cut={cut} aria-label={FESTIVAL_WORDS.thanks}>
      <img className="season-recap__painting" alt="" {...paintingSources("season-citadel")} sizes="100vw" />
      <FireworkSky className="festival-cover__sky" frame={frame} />
      <div className="festival-card">
        <Rangoli size={cut === "tall" ? 360 : 520} className="festival-card__rangoli" />
        <div className="festival-card__words">
          <p className="text-app-label text-app-gold">{season}</p>
          <h1 className={cut === "tall" ? "text-app-title text-app-ink" : "text-app-display text-app-ink"}>
            {FESTIVAL_WORDS.thanks}
          </h1>
          <p className="festival-greeting">{FESTIVAL_WORDS.enjoy}</p>
          <div className="festival-result">
            <HomeArt icon={mark.icon} size={cut === "tall" ? 56 : 88} tier={mark.golden ? "golden" : "regular"} />
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
        </div>
        <SeasonOneTicket />
        <span className="festival-card__diyas">
          <DiyaRow count={cut === "tall" ? 5 : 9} size={cut === "tall" ? 40 : 52} />
        </span>
      </div>
      <div className="festival-cover__steps">{step}</div>
    </section>,
    document.body,
  );
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
