import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AGES } from "@bibliothecadao/types";
import { IdentityRequestError, type CampaignTicket } from "@realms-world/identity";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { heldCampaignTicket, useHeldTicket, useTicketOpened } from "@/hooks/use-holdings";
import { campaignOfPreset } from "@/services/home-claim-rules";
import { AppButton, AppNotice, AppTicket } from "@/ui/design-system/kit/app-elements";
import {
  campaignTicketName,
  DEVCON as DEVCON_NAME,
  HOME_STEP_WORDS,
  JOIN_WORDS,
  TRY_AGAIN,
} from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { entryHref } from "../game-links";
import { useDirectory } from "../herald";
import { chooseSeason } from "../season";
import { useRequestSignIn } from "../sign-in/connect";
import { DEVCON, forgetCampaignCode, keepCampaignCode, keptCampaignCode } from "./devcon";
import { DevconTicket } from "./devcon-ticket";

/** A code as flyers print it; anything else in the address is not kept. */
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
]);

/**
 * Devcon's landing, where every flyer's QR leads (`/join/devcon/<code>`); `/join/devcon` serves a code already kept.
 * One sequence, one job per screen: the sealed ticket and Open (signing in first when needed, then opening at once),
 * then what it holds (its reveal, or the ticket the account already holds), then Choose your home, the Devcon game's
 * Realm step. Nothing before the opening tells a golden ticket from another.
 */
export const JoinDevconPage = () => {
  useKeptFlyerCode();
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
      opening={opening.kind === "opening"}
      refusal={opening.kind === "refused" ? opening : null}
      onOpen={session ? open : () => requestSignIn(OPEN_ON_RETURN)}
    />
  );
};

/** The flyer's code waits in this browser, through sign-in, until the signed-in account opens its ticket. */
const useKeptFlyerCode = () => {
  const { code } = useParams();
  useEffect(() => {
    if (code && PRINTED_CODE.test(code)) keepCampaignCode(code);
  }, [code]);
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
 * one. The code is let go once answered, or refused for good (taken, or the realm already founded).
 */
const openTicket = async (): Promise<Opening> => {
  try {
    const held = await heldCampaignTicket(DEVCON.campaign);
    if (held) return { kind: "held", ticket: held };
    const ticket = await identityClient.redeemCampaignTicket(DEVCON.campaign, keptCampaignCode());
    forgetCampaignCode();
    return { kind: "revealed", ticket };
  } catch (cause) {
    const final = cause instanceof IdentityRequestError ? FINAL_REFUSALS.get(cause.code ?? "") : undefined;
    if (final === undefined) return { kind: "refused", line: JOIN_WORDS.failed, final: false };
    forgetCampaignCode();
    return { kind: "refused", line: final, final: true };
  }
};

/**
 * The ticket before it opens, the same for every flyer and every visitor: its one verb is Open (a new visitor signs in,
 * or signs up, on the way). Refused for good, the way on is Play: the game is open to everyone.
 */
const SealedTicket = ({
  opening,
  refusal,
  onOpen,
}: {
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
    <h1 className="text-app-title text-app-ink">{JOIN_WORDS.yourTicket}</h1>
    <AppTicket art={<TicketArt />} line={JOIN_WORDS.sealed} stub={JOIN_WORDS.stub} />
  </DevconFrame>
);

/** The ticket this flyer opened, turned over: gold under its rays for a golden one, and what its realm claims each day. */
const TicketRevealed = ({ tier, entry }: { tier: CampaignTicket["tier"]; entry: string | null }) => (
  <DevconFrame foot={<ChooseYourHome entry={entry} />}>
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
    forgetCampaignCode();
  }, []);
  return (
    <DevconFrame foot={<ChooseYourHome entry={entry} />}>
      <h1 className="text-app-title text-app-ink">{JOIN_WORDS.alreadyHeld}</h1>
      <DevconTicket tier={tier} />
    </DevconFrame>
  );
};

/** On to the Devcon game's entry, whose Realm step stands on the ticket; it spins until the directory says where. */
const ChooseYourHome = ({ entry }: { entry: string | null }) => (
  <AppButton
    kind="primary"
    size="lg"
    icon="play"
    step
    busy={entry === null ? HOME_STEP_WORDS.title : undefined}
    to={entry ?? "/"}
  >
    {HOME_STEP_WORDS.title}
  </AppButton>
);

/**
 * The running Devcon season's entry; null while the directory has not answered. Play only once it has answered with no
 * Devcon game, or failed (Play says why).
 */
const useDevconEntry = (): string | null => {
  const directory = useDirectory();
  if (directory.isError) return "/";
  if (!directory.data) return null;
  const season = chooseSeason(
    directory.data.games.filter((game) => campaignOfPreset(game.preset_id) === DEVCON.campaign),
    false,
  );
  return season ? entryHref(season, "play") : "/";
};

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
    <PageFrame
      back="/"
      title={DEVCON_NAME}
      painting="frontier-mist"
      stage
      tabs={false}
      notice={notice}
      foot={phone ? verb : undefined}
    >
      <div className="mx-auto flex max-w-[28rem] flex-col items-center gap-5 pt-4 text-center">
        {children}
        {!phone && verb}
      </div>
    </PageFrame>
  );
};
