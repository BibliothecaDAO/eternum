import "./season-recap.css";
import "./festival.css";

import { formatAmount, formatExact, LORDS } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { homeIcon } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";
import { AppTicket } from "@/ui/design-system/kit/app-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { FESTIVAL_WORDS, RECAP_WORDS, SEASON_ENDINGS } from "@/ui/design-system/kit/words";

import { DiyaRow, FireworkSky, Rangoli } from "./festival-art";

/**
 * Season 0's end dressed for Diwali (the owner, 11-04): `sky` sets the season under fireworks with the ticket beside
 * the season; `deck` dresses the deck itself, the image the player shares, with the ticket stamped on their place.
 * `ticket`: the player owns a Devcon realm, so a Season 1 ticket waits on their account. `frame` holds the fireworks
 * at that second of their opening (the lab's frame strip).
 */
export type Festival = { look: "sky" | "deck"; ticket: boolean; frame?: number };

/** The Season 1 ticket's realm: Devcon's, as the owner chose to reuse it. */
const TICKET_REALM = homeIcon("devcon", 3);

/** The season's heading on Diwali: thanks for playing, the season's ending and the greeting under it. */
export const FestivalHeading = ({ ending, tall }: { ending: keyof typeof SEASON_ENDINGS; tall: boolean }) => (
  <>
    <h1 className={tall ? "text-app-title text-app-ink" : "text-app-display text-app-ink"}>{FESTIVAL_WORDS.thanks}</h1>
    <p className="festival-greeting">{`${SEASON_ENDINGS[ending]} · ${FESTIVAL_WORDS.diwali}`}</p>
  </>
);

/** The Season 1 ticket in one row: its realm, what it is, and that it is already on the account. */
export const SeasonTicketStrip = () => (
  <div className="festival-ticket-strip">
    <Icon name={TICKET_REALM} size={64} />
    <span>
      <b>{FESTIVAL_WORDS.ticketTitle}</b>
      <small>{`${FESTIVAL_WORDS.ticketLine} · ${FESTIVAL_WORDS.ticketHow}`}</small>
    </span>
  </div>
);

/** The Season 1 ticket stamped on the player's place in the deck, so the shared image carries it. */
export const SeasonTicketStamp = () => (
  <span className="festival-ticket-stamp">
    <Icon name={TICKET_REALM} size={64} />
    <small>{FESTIVAL_WORDS.ticketTitle}</small>
  </span>
);

/** The Season 1 ticket, whole: the ticket the Devcon landing turned over, with Devcon's realm, and where it is. */
const SeasonTicket = () => (
  <div className="festival-ticket">
    <p className="text-app-label text-app-gold">{FESTIVAL_WORDS.ticketTitle}</p>
    <AppTicket
      face="opened"
      art={<Icon name={TICKET_REALM} size={128} />}
      line={FESTIVAL_WORDS.ticketLine}
      stub={FESTIVAL_WORDS.ticketStub}
    />
    <p className="festival-ticket__how">{FESTIVAL_WORDS.ticketHow}</p>
  </div>
);

/**
 * The greeting that opens the season's end, before the deck: thanks and the festival, the player's place with their
 * home, and the Season 1 ticket for a Devcon realm's owner (else, see you in Season 1), under the fireworks. Its one
 * step opens the deck.
 */
export const SeasonGreeting = ({
  cut,
  season,
  home,
  rank,
  field,
  prize,
  ticket,
  frame,
  step,
}: {
  cut: "wide" | "tall";
  /** "Season 0 · Ended 6 Nov". */
  season: string;
  /** The player's home this season, as it is drawn (HomeArt). */
  home: ReactNode;
  rank: number;
  field: number;
  prize: number | undefined;
  ticket: boolean;
  frame?: number;
  /** See my season: the deck. */
  step: ReactNode;
}) => (
  <section className="festival-cover" data-surface="shell" data-cut={cut} aria-label={FESTIVAL_WORDS.thanks}>
    <img className="season-recap__painting" alt="" {...paintingSources("season-citadel")} sizes="100vw" />
    <FireworkSky className="season-recap__sky" frame={frame} />
    <div className="festival-card" data-ticket={ticket ? "held" : "none"}>
      <Rangoli size={cut === "tall" ? 360 : 520} className="festival-card__rangoli" />
      <div className="festival-card__words">
        <p className="text-app-label text-app-gold">{season}</p>
        <h1 className={cut === "tall" ? "text-app-title text-app-ink" : "text-app-display text-app-ink"}>
          {FESTIVAL_WORDS.thanks}
        </h1>
        <p className="festival-greeting">{FESTIVAL_WORDS.enjoy}</p>
        <div className="festival-result">
          {home}
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
        {!ticket && <p className="festival-ticket__how">{FESTIVAL_WORDS.seeYou}</p>}
      </div>
      {ticket && <SeasonTicket />}
      <span className="festival-card__diyas">
        <DiyaRow count={cut === "tall" ? 5 : 9} size={cut === "tall" ? 36 : 44} />
      </span>
    </div>
    <div className="festival-cover__steps">{step}</div>
  </section>
);
