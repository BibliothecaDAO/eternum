import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { canonicalRealm, homeSourceClaim, type HomeClaimSource, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import { IdentityRequestError, type CampaignKey, type CampaignTicket, type Session } from "@realms-world/identity";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { campaignOfPreset, presetLaborRules } from "@/services/home-claim-rules";
import { readHeldRealms } from "@/services/realm-entry";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import {
  FREE_REALM_ENTRY,
  HELD_REALMS_UNREADABLE,
  INVALID_REALM_NUMBER,
  LINK_WALLET,
  NO_HELD_REALMS,
  NO_WALLET,
  OPTIONAL_REALM_NUMBER,
  REALM,
  YOUR_REALMS,
  campaignHomeName,
  homeClaimLine,
} from "@/ui/design-system/kit/words";
import { RealmNumberField, isRealmNumber } from "./realm-number-picker";

/** What the player's linked wallet holds, as the Realm step can tell it. */
type Holdings =
  | { kind: "unlinked" }
  | { kind: "pending" }
  | { kind: "unreadable" }
  | { kind: "held"; realms: readonly number[] };

/**
 * A Frontier game's Realm step: the player's own Realms to found their home with, and the home they will found. A Realm
 * picked here is registered as the home's source; with none, the relay registers the campaign ticket the account holds
 * for this game's preset, and with neither the home is free (apps/value-relay/src/realm-entry.ts). The line under the
 * picks says what that home will claim each day, by the claim's own rule (homeSourceClaim) on the game's preset rules.
 */
export function HomeSourcePicker({
  presetId,
  value,
  onChange,
  disabled,
}: {
  presetId: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { holdings, ticket, rules } = useHomeSources(presetId);
  const line = homeLine(value, ticket, rules);
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-hud-line p-3">
      <span className="text-hud-label text-hud-muted">{YOUR_REALMS}</span>
      <HeldRealmChoice holdings={holdings} value={value} onChange={onChange} disabled={disabled} />
      <p aria-live="polite" className="text-hud-body text-hud-ink">
        {line}
      </p>
    </div>
  );
}

/** The account's linked wallet's Realms, its campaign ticket for this preset's games, and the preset's claim rules. */
function useHomeSources(presetId: number) {
  const { session } = useIdentitySession();
  const wallet = session?.user.address ?? null;
  const campaign = campaignOfPreset(presetId);
  const held = useQuery({
    queryKey: ["held-realms", session?.user.realmsId ?? null, wallet] as const,
    queryFn: readHeldRealms,
    enabled: wallet !== null,
    retry: false,
    staleTime: 60_000,
  });
  const ticket = useQuery({
    queryKey: ["campaign-ticket", session?.user.realmsId ?? null, campaign] as const,
    queryFn: () => (campaign === null ? null : heldCampaignTicket(campaign)),
    enabled: session !== null && campaign !== null,
    retry: false,
    staleTime: 60_000,
  });
  const rules = useMemo(() => presetLaborRules(presetId), [presetId]);
  return { holdings: holdingsOf(session, wallet, held), ticket: heldTicketOf(campaign, ticket.data), rules };
}

/** The account's ticket for this game, as its campaign and tier; undefined while it is not known yet. */
type HeldTicket = { campaign: CampaignKey; golden: boolean } | null | undefined;

const heldTicketOf = (campaign: CampaignKey | null, ticket: CampaignTicket | null | undefined): HeldTicket => {
  if (campaign === null || ticket === null) return null;
  return ticket && { campaign, golden: ticket.tier === "golden" };
};

function holdingsOf(
  session: Session | null,
  wallet: string | null,
  held: { isError: boolean; data: number[] | undefined },
): Holdings {
  if (session === null) return { kind: "unreadable" };
  if (wallet === null) return { kind: "unlinked" };
  if (held.isError) return { kind: "unreadable" };
  return held.data ? { kind: "held", realms: held.data } : { kind: "pending" };
}

/** The ticket the account already holds to this campaign; null when it holds none. Opens no flyer. */
async function heldCampaignTicket(campaign: CampaignKey): Promise<CampaignTicket | null> {
  try {
    return await identityClient.redeemCampaignTicket(campaign, null);
  } catch (cause) {
    if (
      cause instanceof IdentityRequestError &&
      (cause.code === "invalid_redemption" || cause.code === "campaign_closed")
    )
      return null;
    throw cause;
  }
}

/**
 * The picks: the held Realms, one press each (again to let it go); without a linked wallet, the way to link one; and only
 * when the holdings cannot be read, the Realm's number typed, which the relay checks against the wallet either way.
 */
function HeldRealmChoice({
  holdings,
  value,
  onChange,
  disabled,
}: {
  holdings: Holdings;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  if (holdings.kind === "pending") return null;
  if (holdings.kind === "unlinked")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-hud-body text-hud-muted">{NO_WALLET}</span>
        <HudChip onPress={() => navigate(linkWalletHref(returnPathOf(location)))} disabled={disabled}>
          {LINK_WALLET}
        </HudChip>
      </div>
    );
  if (holdings.kind === "unreadable")
    return (
      <>
        <span className="text-hud-body text-hud-muted">{HELD_REALMS_UNREADABLE}</span>
        <span className="text-hud-label text-hud-muted">{OPTIONAL_REALM_NUMBER}</span>
        <RealmNumberField value={value} onChange={onChange} disabled={disabled} />
      </>
    );
  const realms = pickedAmong(holdings.realms, value);
  if (realms.length === 0) return <span className="text-hud-body text-hud-muted">{NO_HELD_REALMS}</span>;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={YOUR_REALMS}>
      {realms.map((realmId) => {
        const picked = value === String(realmId);
        return (
          <HudChip
            key={realmId}
            tone={picked ? "good" : undefined}
            label={REALM}
            onPress={() => onChange(picked ? "" : String(realmId))}
            disabled={disabled}
          >
            {realmName(realmId)}
          </HudChip>
        );
      })}
    </div>
  );
}

/** The held Realms, with the one already registered for this game among them even if the index no longer lists it. */
const pickedAmong = (held: readonly number[], value: string) =>
  isRealmNumber(value) && !held.includes(Number(value)) ? [...held, Number(value)] : [...held];

const realmName = (realmId: number) => {
  const name = canonicalRealm(realmId)?.name;
  return name ? `${realmId} · ${name}` : String(realmId);
};

/**
 * The home this step founds and what it claims each game day: the picked Realm's, else the ticket's (golden's for a
 * golden ticket, which the player has already opened), else a free home's nothing. Null while the ticket is unknown.
 */
function homeLine(value: string, ticket: HeldTicket, rules: LaborRuleAmounts | null): string | null {
  if (value !== "")
    return isRealmNumber(value) ? claimLine(realmName(Number(value)), { kind: "realm" }, rules) : INVALID_REALM_NUMBER;
  if (ticket === undefined) return null;
  if (ticket === null) return FREE_REALM_ENTRY;
  return claimLine(
    campaignHomeName(ticket.campaign, ticket.golden),
    { kind: "campaign", golden: ticket.golden },
    rules,
  );
}

/** The home's name and its daily claim; the name alone when this client cannot tell the game's rules. */
function claimLine(home: string, source: HomeClaimSource, rules: LaborRuleAmounts | null) {
  const claim = rules && homeSourceClaim(rules, source);
  return claim ? homeClaimLine(home, claim) : home;
}
