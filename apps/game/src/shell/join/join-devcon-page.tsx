import { AGES } from "@bibliothecadao/types";
import { IdentityRequestError, type CampaignTicket } from "@realms-world/identity";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppNotice, AppPanel, AppTicket } from "@/ui/design-system/kit/app-elements";
import { DEVCON as DEVCON_NAME, JOIN_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { useRequestSignIn } from "../sign-in/connect";
import { DEVCON, forgetCampaignCode, keepCampaignCode, keptCampaignCode } from "./devcon";

const FRONTIER_LOCKUP = "/images/logos/frontier-lockup.webp";
/** A code as flyers print it; anything else in the address is not kept. */
const PRINTED_CODE = /^[A-Za-z0-9]{8}$/;

/** A refusal a retry can change (the network, the service) or one it cannot (the campaign or the code says no). */
type Opening =
  | { kind: "sealed" }
  | { kind: "opening" }
  | { kind: "refused"; line: string; final: boolean }
  | CampaignTicket;

/** The identity service's answers no retry changes, each with what the player reads. */
const FINAL_REFUSALS = new Map<string, string>([
  ["campaign_closed", JOIN_WORDS.closed],
  ["ticket_taken", JOIN_WORDS.taken],
  ["invalid_redemption", JOIN_WORDS.noTicket],
]);

/**
 * Devcon's landing, where every flyer's QR leads (`/join/devcon/<code>`); `/join/devcon` serves a code already kept,
 * as when a sign-in finished elsewhere comes back. It looks the same for every code: the code waits in this browser, through sign-in, until the signed-in player opens their
 * ticket, and only the answer to that account tells a golden ticket from another.
 */
export const JoinDevconPage = () => {
  const { code } = useParams();
  useEffect(() => {
    if (code && PRINTED_CODE.test(code)) keepCampaignCode(code);
  }, [code]);
  const { status, session } = useIdentitySession();
  const [opening, setOpening] = useState<Opening>({ kind: "sealed" });
  const open = () => {
    setOpening({ kind: "opening" });
    void redeemTicket().then(setOpening);
  };
  if (!session) return <DevconLanding waiting={status === "loading"} />;
  if ("tier" in opening) return <OpenedTicket tier={opening.tier} />;
  return (
    <SealedTicket
      opening={opening.kind === "opening"}
      refusal={opening.kind === "refused" ? opening : null}
      onOpen={open}
    />
  );
};

/** The signed-in account's ticket: the one it holds, else one from the kept code. The code is spent once answered. */
const redeemTicket = async (): Promise<Opening> => {
  try {
    const ticket = await identityClient.redeemCampaignTicket(DEVCON.campaign, keptCampaignCode());
    forgetCampaignCode();
    return ticket;
  } catch (cause) {
    const final = cause instanceof IdentityRequestError ? FINAL_REFUSALS.get(cause.code ?? "") : undefined;
    return { kind: "refused", line: final ?? JOIN_WORDS.failed, final: final !== undefined };
  }
};

/** Before sign-in: the realm the ticket holds and what it claims each day, and the one way on. */
const DevconLanding = ({ waiting }: { waiting: boolean }) => {
  const location = useLocation();
  const requestSignIn = useRequestSignIn();
  return (
    <DevconFrame
      foot={
        <AppButton
          kind="primary"
          size="lg"
          icon="realm"
          step
          disabled={waiting}
          onClick={() => requestSignIn(`${location.pathname}${location.search}`)}
        >
          {JOIN_WORDS.claim}
        </AppButton>
      }
    >
      <img src={FRONTIER_LOCKUP} alt={AGES.frontier.game} className="w-48 md:w-60" />
      <Icon name="realm" size={192} />
      <h1 className="text-app-title text-app-ink">{JOIN_WORDS.realm}</h1>
      <DailyClaim golden={false} />
    </DevconFrame>
  );
};

/** The ticket before it opens. Once it is refused for good, the way on is Play: the game is open to everyone. */
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

/** The ticket turned over: gold under its rays for a golden one, and what its realm claims each day. */
const OpenedTicket = ({ tier }: { tier: CampaignTicket["tier"] }) => {
  const golden = tier === "golden";
  return (
    <DevconFrame foot={<ContinueToPlay />}>
      <h1 className="text-app-title text-app-ink">{golden ? JOIN_WORDS.golden : JOIN_WORDS.yourTicket}</h1>
      <AppTicket
        face={golden ? "golden" : "opened"}
        art={<TicketArt />}
        line={golden ? JOIN_WORDS.goldenLine : JOIN_WORDS.realm}
        stub={golden ? JOIN_WORDS.goldenStub(DEVCON.golden) : JOIN_WORDS.stub}
      />
      <DailyClaim golden={golden} />
    </DevconFrame>
  );
};

const ContinueToPlay = () => (
  <AppButton kind="primary" size="lg" icon="play" step to="/">
    {JOIN_WORDS.continue}
  </AppButton>
);

const TicketArt = () => <img src={FRONTIER_LOCKUP} alt={AGES.frontier.game} className="h-28 w-auto" />;

/** What this ticket's realm claims each Frontier day. */
const DailyClaim = ({ golden }: { golden: boolean }) => {
  const { labor, essence } = DEVCON.claim(golden);
  return (
    <AppPanel className="w-full max-w-[20rem]">
      <ul className="flex flex-col gap-3 text-left text-app-strong text-app-ink">
        <li className="flex items-center gap-3">
          <Icon name="labor" size={32} />
          {JOIN_WORDS.laborEachDay(labor)}
        </li>
        <li className="flex items-center gap-3">
          <Icon name="essence" size={32} />
          {JOIN_WORDS.essenceEachDay(essence)}
        </li>
      </ul>
    </AppPanel>
  );
};

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
