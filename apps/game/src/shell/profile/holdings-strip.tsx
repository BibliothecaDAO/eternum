import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canonicalRealm } from "@bibliothecadao/eternum";

import { useHeldRealms, useHeldTicket, type HeldTicket } from "@/hooks/use-holdings";
import { realmSkinIcon } from "@/three/structures/realm-skins";
import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton, AppEmpty } from "@/ui/design-system/kit/app-elements";
import {
  DEVCON as DEVCON_NAME,
  HELD_REALMS_UNREADABLE,
  JOIN_WORDS,
  NO_HELD_REALMS,
  PROFILE_WORDS,
  TICKET_UNREADABLE,
  TRY_AGAIN,
  WORDS,
  YOUR_REALMS,
  numberedRealm,
} from "@/ui/design-system/kit/words";

import { MARKET } from "../community";
import { ShellWindow } from "../frame/shell-window";
import { DEVCON } from "../join/devcon";
import { DevconTicket } from "../join/devcon-ticket";
import { returnPathOf } from "../return-path";
import { linkWalletHref } from "./settings-route";

type Sheet = "realms" | "ticket";

/**
 * What the player holds, counted at the foot of their own card, each count opening its sheet (owner's pick, holdings
 * layout C). The account's Realms (its linked wallet's, as a game's Realm step reads them) and its Devcon ticket; with no
 * linked wallet, the way to link one, for the Realms it holds and the LORDS a season pays to it. LORDS counted, chests
 * and cosmetics join later.
 */
export const HoldingsStrip = () => {
  const { wallet, held } = useHeldRealms();
  const ticket = useHeldTicket(DEVCON.campaign);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const golden = ticket.state === "held" && ticket.ticket.tier === "golden";
  return (
    <>
      <div className="app-holdings" role="group" aria-label={PROFILE_WORDS.holdings}>
        {wallet === null ? (
          <Holding
            icon="backpack"
            label={PROFILE_WORDS.linkWalletHoldings}
            onPress={() => navigate(linkWalletHref(returnPathOf(location)))}
          />
        ) : (
          <Holding
            icon="realm"
            count={held.isError ? PROFILE_WORDS.unknownCount : held.data?.length}
            label={PROFILE_WORDS.realms}
            onPress={() => setSheet("realms")}
          />
        )}
        {(ticket.state === "held" || ticket.state === "unreadable") && (
          <Holding
            icon={realmSkinIcon(golden ? "devcon-golden" : "devcon")}
            count={ticket.state === "held" ? DEVCON_NAME : PROFILE_WORDS.unknownCount}
            label={golden ? JOIN_WORDS.golden : PROFILE_WORDS.ticket}
            onPress={() => setSheet("ticket")}
          />
        )}
      </div>
      {sheet === "realms" && <RealmsSheet held={held} onClose={() => setSheet(null)} />}
      {sheet === "ticket" && (ticket.state === "held" || ticket.state === "unreadable") && (
        <TicketSheet ticket={ticket} onClose={() => setSheet(null)} />
      )}
    </>
  );
};

/** One count: its painting, its number (blank while it is read), its name. */
const Holding = ({
  icon,
  count,
  label,
  onPress,
}: {
  icon: IconMeaning;
  count?: number | string;
  label: string;
  onPress: () => void;
}) => (
  <button type="button" className="app-holdings__item" onClick={onPress}>
    <Icon name={icon} size={44} />
    {count !== undefined && <b className="text-app-strong text-app-ink">{count}</b>}
    <span className="text-app-label text-app-muted">{label}</span>
  </button>
);

/** The account's Devcon ticket, as the landing shows it opened; or, while it cannot be read, why, and Try again. */
const TicketSheet = ({
  ticket,
  onClose,
}: {
  ticket: Extract<HeldTicket, { state: "held" | "unreadable" }>;
  onClose: () => void;
}) => {
  const golden = ticket.state === "held" && ticket.ticket.tier === "golden";
  return (
    <ShellWindow title={golden ? JOIN_WORDS.golden : JOIN_WORDS.yourTicket} onClose={onClose}>
      {ticket.state === "held" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <DevconTicket tier={ticket.ticket.tier} />
          <AppButton kind="primary" icon="play" to="/">
            {WORDS.play}
          </AppButton>
        </div>
      ) : (
        <AppEmpty
          icon={realmSkinIcon("devcon")}
          line={TICKET_UNREADABLE}
          action={
            <AppButton kind="secondary" onClick={ticket.retry}>
              {TRY_AGAIN}
            </AppButton>
          }
        />
      )}
    </ShellWindow>
  );
};

/** The linked wallet's Realms, each by its number and name; the Market sells and buys them. */
const RealmsSheet = ({ held, onClose }: { held: ReturnType<typeof useHeldRealms>["held"]; onClose: () => void }) => (
  <ShellWindow title={YOUR_REALMS} onClose={onClose}>
    <div className="flex flex-col gap-4">
      {held.isError ? (
        <AppEmpty
          icon="realm"
          line={HELD_REALMS_UNREADABLE}
          action={
            <AppButton kind="secondary" onClick={() => void held.refetch()}>
              {TRY_AGAIN}
            </AppButton>
          }
        />
      ) : held.data?.length === 0 ? (
        <AppEmpty icon="realm" line={NO_HELD_REALMS} />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={YOUR_REALMS}>
          {held.data?.map(({ realmId }) => (
            <li key={realmId} className="flex items-center gap-3 text-app-strong text-app-ink">
              <Icon name="realm" size={36} />
              {numberedRealm(realmId, canonicalRealm(realmId)?.name)}
            </li>
          ))}
        </ul>
      )}
      <AppButton kind="secondary" icon="trade" onClick={() => window.open(MARKET, "_blank", "noopener")}>
        {WORDS.market}
      </AppButton>
    </div>
  </ShellWindow>
);
