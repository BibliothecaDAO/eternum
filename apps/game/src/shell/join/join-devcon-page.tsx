import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AGES } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import {
  CAMPAIGNS,
  IdentityRequestError,
  seasonMoment,
  type CampaignOpening,
  type CampaignTicket,
} from "@realms-world/identity";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { heldCampaignTicket, useHeldTicket, useTicketOpened } from "@/hooks/use-holdings";
import { AppButton, AppNotice, AppPortrait, AppTicket } from "@/ui/design-system/kit/app-elements";
import { campaignTicketName, DEVCON as DEVCON_NAME, JOIN_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRequestSignIn } from "../sign-in/connect";
import { DEVCON, forgetCampaignOpening, keepCampaignOpening, keptCampaignOpening } from "./devcon";
import { useDevconEntry } from "./devcon-entry";
import { DevconTicket } from "./devcon-ticket";

/** A code as flyers and referral links carry it; anything else in the address is not kept. */
const PRINTED_CODE = /^[A-Za-z0-9]{8}$/;

/** Where sign-in returns from the landing: the bare link (it serves the kept code), asking to open the ticket at once. */
const OPEN_ON_RETURN = "/join/devcon?open";

/**
 * The ticket's life on this page: sealed, opening, refused (for good or until a retry), opened by this flyer (the
 * reveal), or already held from an earlier one (the account keeps one ticket; this flyer's code stays unspent).
 */
type Opening =
  | { kind: "sealed" }
  | { kind: "opening" }
  | { kind: "refused"; line: string; final: boolean }
  | { kind: "revealed"; ticket: CampaignTicket }
  | { kind: "held"; ticket: CampaignTicket };

/** The identity service's answers no retry changes, each with what the player reads. */
const FINAL_REFUSALS = new Map<string, string>([
  ["campaign_closed", JOIN_WORDS.closed],
  ["ticket_taken", JOIN_WORDS.taken],
  ["realm_founded", JOIN_WORDS.founded],
  ["invalid_redemption", JOIN_WORDS.noTicket],
  ["self_referral", JOIN_WORDS.selfReferral],
  ["referral_unknown", JOIN_WORDS.referralUnknown],
]);

/**
 * Devcon's landing, where every flyer's QR leads (`/join/devcon/<code>`), and every friend's referral link
 * (`/join/devcon/r/<code>`, naming who sent it); `/join/devcon` serves a code already kept. One sequence, one job per
 * screen: the sealed ticket and Open (signing in first when needed, then opening at once), then what it holds (its
 * reveal, or the ticket the account already holds), then Start your adventure, into the Devcon game's entry. Nothing before
 * the opening tells a golden ticket from another.
 */
export const JoinDevconPage = () => {
  const kept = useKeptOpening();
  const { session } = useIdentitySession();
  const held = useHeldTicket(session ? DEVCON.campaign : null);
  const requestSignIn = useRequestSignIn();
  const [opening, setOpening] = useState<Opening>({ kind: "sealed" });
  const ticketOpened = useTicketOpened();
  // Read from the first screen, so the Devcon game is known by the time the ticket is shown.
  const entry = useDevconEntry();
  const open = () => {
    setOpening({ kind: "opening" });
    void openTicket().then(async (answer) => {
      // Every screen that shows the account's ticket (You, a game's Realm step) shows it at once.
      if (answer.kind === "revealed" || answer.kind === "held") await ticketOpened(DEVCON.campaign, answer.ticket);
      setOpening(answer);
    });
  };
  useOpenOnReturn(session !== null && opening.kind === "sealed", open);
  if (opening.kind === "revealed") return <TicketRevealed tier={opening.ticket.tier} entry={entry} />;
  if (opening.kind === "held") return <TicketHeld tier={opening.ticket.tier} entry={entry} />;
  if (held.state === "held" && opening.kind === "sealed") return <TicketHeld tier={held.ticket.tier} entry={entry} />;
  return (
    <SealedTicket
      referral={kept && "referral" in kept ? kept.referral : null}
      opening={opening.kind === "opening"}
      refusal={opening.kind === "refused" ? opening : null}
      onOpen={session ? open : () => requestSignIn(OPEN_ON_RETURN)}
    />
  );
};

/**
 * The flyer's code or the referral link's waits in this browser, through sign-in, until the signed-in account opens its
 * ticket; the one in effect is the address's, or the one kept.
 */
const useKeptOpening = (): CampaignOpening | null => {
  const { code, referral } = useParams();
  useEffect(() => {
    const opened = openingOf(code, referral);
    if (opened) keepCampaignOpening(opened);
  }, [code, referral]);
  return openingOf(code, referral) ?? keptCampaignOpening();
};

const openingOf = (code: string | undefined, referral: string | undefined): CampaignOpening | null => {
  if (referral && PRINTED_CODE.test(referral)) return { referral };
  return code && PRINTED_CODE.test(code) ? { code } : null;
};

/** Back from sign-in (`?open`), the ticket opens without a second press; the address loses `?open` so a reload does not. */
const useOpenOnReturn = (ready: boolean, open: () => void) => {
  const location = useLocation();
  const navigate = useNavigate();
  const asked = new URLSearchParams(location.search).has("open");
  const opened = useRef(false);
  useEffect(() => {
    if (!asked || !ready || opened.current) return;
    opened.current = true;
    navigate(location.pathname, { replace: true });
    open();
  }, [asked, ready, open, navigate, location.pathname]);
};

/**
 * The signed-in account's ticket. One it already holds is shown as held, and this flyer's code is never redeemed: the
 * account keeps one ticket per campaign, so the server would only answer the held one. Otherwise the kept code opens
 * one. The code is let go once answered, or refused for good (taken, or the realm already has a source).
 */
const openTicket = async (): Promise<Opening> => {
  try {
    const held = await heldCampaignTicket(DEVCON.campaign);
    if (held) return { kind: "held", ticket: held };
    const ticket = await identityClient.redeemCampaignTicket(DEVCON.campaign, keptCampaignOpening());
    forgetCampaignOpening();
    return { kind: "revealed", ticket };
  } catch (cause) {
    const final = cause instanceof IdentityRequestError ? FINAL_REFUSALS.get(cause.code ?? "") : undefined;
    if (final === undefined) return { kind: "refused", line: JOIN_WORDS.failed, final: false };
    forgetCampaignOpening();
    return { kind: "refused", line: final, final: true };
  }
};

/**
 * The ticket before it opens, the same for every flyer and every visitor, under who sent it for a referral link: its one
 * verb is Open (a new visitor signs in, or signs up, on the way). Refused for good, the way on is Play: the game is open
 * to everyone.
 */
const SealedTicket = ({
  referral,
  opening,
  refusal,
  onOpen,
}: {
  referral: string | null;
  opening: boolean;
  refusal: { line: string; final: boolean } | null;
  onOpen: () => void;
}) => (
  <DevconFrame
    notice={refusal ? <AppNotice tone="bad" line={refusal.line} /> : undefined}
    foot={
      refusal?.final ? (
        <ContinueToPlay />
      ) : (
        <AppButton kind="primary" size="lg" step busy={opening ? JOIN_WORDS.opening : undefined} onClick={onOpen}>
          {refusal ? TRY_AGAIN : JOIN_WORDS.open}
        </AppButton>
      )
    }
  >
    {referral && <SentBy referral={referral} />}
    <h1 className="text-app-title text-app-ink">{JOIN_WORDS.yourTicket}</h1>
    <AppTicket art={<TicketArt />} line={JOIN_WORDS.sealed} stub={JOIN_WORDS.stub} />
    <p className="text-sm text-app-ink opacity-75">{JOIN_WORDS.openUntil(SEASON_END)}</p>
  </DevconFrame>
);

const SEASON_END = seasonMoment(
  DEVCON.closesAt,
  CAMPAIGNS[DEVCON.campaign].clock.timeZone,
  CAMPAIGNS[DEVCON.campaign].clock.zone,
);

/** Who sent a referral link, by their chosen name; nothing until the identity service answers. */
const SentBy = ({ referral }: { referral: string }) => {
  const inviter = useQuery({
    queryKey: ["campaign-referrer", DEVCON.campaign, referral] as const,
    queryFn: () => identityClient.campaignReferrer(DEVCON.campaign, referral),
    retry: false,
    staleTime: Infinity,
  });
  if (inviter.data === undefined) return null;
  return (
    <div className="flex items-center gap-3">
      {inviter.data && <AppPortrait name={inviter.data} size="lg" />}
      <span className="text-left text-app-ink">{JOIN_WORDS.sentYou(inviter.data)}</span>
    </div>
  );
};

/** The ticket this flyer opened, turned over: gold under its rays for a golden one, and what its realm claims each day. */
const TicketRevealed = ({ tier, entry }: { tier: CampaignTicket["tier"]; entry: string | null }) => (
  <DevconFrame foot={<StartYourAdventure entry={entry} />}>
    <h1 className="text-app-title text-app-ink">{campaignTicketName(DEVCON.campaign, tier === "golden")}</h1>
    <DevconTicket tier={tier} />
  </DevconFrame>
);

/**
 * A second flyer on an account that already holds its ticket: that ticket, said plainly, never this flyer's. The flyer's
 * code leaves this browser unspent, for someone else.
 */
const TicketHeld = ({ tier, entry }: { tier: CampaignTicket["tier"]; entry: string | null }) => {
  useEffect(() => {
    forgetCampaignOpening();
  }, []);
  return (
    <DevconFrame foot={<StartYourAdventure entry={entry} />}>
      <h1 className="text-app-title text-app-ink">{JOIN_WORDS.alreadyHeld}</h1>
      <DevconTicket tier={tier} />
    </DevconFrame>
  );
};

/** On to the Devcon game's entry, whose Realm step stands on the ticket; it spins until the directory says where. */
const StartYourAdventure = ({ entry }: { entry: string | null }) => (
  <AppButton
    kind="primary"
    size="lg"
    icon="play"
    step
    busy={entry === null ? JOIN_WORDS.startAdventure : undefined}
    to={entry ?? "/"}
  >
    {JOIN_WORDS.startAdventure}
  </AppButton>
);

const ContinueToPlay = () => (
  <AppButton kind="primary" size="lg" icon="play" step to="/">
    {JOIN_WORDS.continue}
  </AppButton>
);

const TicketArt = () => <img src={AGE_LOCKUP.frontier} alt={AGES.frontier.game} className="h-28 w-auto" />;

/**
 * Every step of the landing stands on Frontier's mist, alone, with no places; Back leads to Play. Its one verb sits under the thumb on a
 * phone (the foot row) and under what it acts on on a desktop, as the Blitz lobby places its own.
 */
const DevconFrame = ({ notice, foot, children }: { notice?: ReactNode; foot: ReactNode; children: ReactNode }) => {
  const phone = useLayout() === "phone";
  const verb = <div className="flex justify-center">{foot}</div>;
  return (
    <PageFrame title={DEVCON_NAME} painting="frontier-mist" stage notice={notice} foot={phone ? verb : undefined}>
      <div className="mx-auto flex max-w-[28rem] flex-col items-center gap-5 pt-4 text-center [@media(max-height:720px)]:gap-3 [@media(max-height:720px)]:pt-2">
        {children}
        {!phone && verb}
      </div>
    </PageFrame>
  );
};
