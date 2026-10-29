import "./home-source-picker.css";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { canonicalRealm, homeSourceClaim, type HomeClaimSource, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import { orders } from "@bibliothecadao/types";
import { IdentityRequestError, type CampaignKey, type CampaignTicket, type HeldRealm } from "@realms-world/identity";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { campaignOfPreset, presetLaborRules } from "@/services/home-claim-rules";
import { readHeldRealms } from "@/services/realm-entry";
import { useLayout } from "@/shell/frame/layout";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { realmSkinIcon } from "@/three/structures/realm-skins";
import { Icon } from "@/ui/design-system/icon";
import { mintedResourceMeaning, orderMeaning } from "@/ui/design-system/icon-meaning";
import {
  HELD_REALMS_UNREADABLE,
  HOME_STEP_WORDS,
  JOIN_WORDS,
  TICKET_UNREADABLE,
  TRY_AGAIN,
  campaignTicketName,
} from "@/ui/design-system/kit/words";

/**
 * A Frontier game's Realm step (owner's pick, option B of reports/entry-realm-picker-5.md): one job, choose your home.
 * It offers only what the player can found with: the campaign ticket the account holds for this game's preset, the
 * Realms its linked wallet holds, or, with neither, a free home. The chosen one stands large with what it claims each
 * day (homeSourceClaim on the game's preset rules); the others sit in a strip under it, and past the strip, All opens
 * every choice with search. A ticket and a Realm never combine: the relay registers one source per home
 * (apps/value-relay/src/realm-entry.ts).
 *
 * `value` is the pick: a Realm's number, or "" for the ticket (or, holding none, the free home). It starts on the ticket,
 * else on the first Realm in the step's order, and it never outlives the choice that offered it. `registered` is the
 * Realm the relay already holds for this game: the home's source for good, shown alone and locked. `onSettled` says
 * whether the pick stands on what the account holds, so founding waits for the reads rather than founding a free home.
 */
export function HomeSourcePicker({
  presetId,
  registered,
  value,
  onChange,
  onSettled,
  disabled,
}: {
  presetId: number;
  registered: number | null;
  value: string;
  onChange: (value: string) => void;
  onSettled: (settled: boolean) => void;
  disabled: boolean;
}) {
  const sources = useHomeSources(presetId);
  const choices = choicesOf(sources);
  const offered = usePickOffered(choices, sources.ready, registered, value, onChange, disabled);
  const settled = registered !== null || (sources.ready && offered);
  useEffect(() => {
    onSettled(settled);
  }, [settled, onSettled]);
  const picked = registered !== null ? realmChoice({ realmId: registered, map: null }) : pickedChoice(choices, value);
  return (
    <section className="home-picker" aria-label={HOME_STEP_WORDS.title}>
      <header className="home-picker__head">
        <h2>{HOME_STEP_WORDS.title}</h2>
        {registered === null && choices.length > 0 && <span>{choiceCount(choices)}</span>}
      </header>
      {picked ? (
        <Featured choice={picked} rules={sources.rules} locked={registered !== null} />
      ) : sources.ready ? (
        <FreeHome unlinked={sources.wallet === null} />
      ) : (
        <div className="home-picker__waiting" aria-busy />
      )}
      {registered === null && choices.length > 1 && (
        <Choices choices={choices} value={value} onChange={onChange} disabled={disabled} />
      )}
      {registered === null && sources.ready && sources.wallet === null && choices.length > 0 && <LinkWallet />}
      {registered === null && sources.ticketUnreadable && (
        <Unreadable line={TICKET_UNREADABLE} retry={sources.ticketUnreadable} />
      )}
      {registered === null && sources.realmsUnreadable && (
        <Unreadable line={HELD_REALMS_UNREADABLE} retry={sources.realmsUnreadable} />
      )}
    </section>
  );
}

/** One thing the player can found with: the account's campaign ticket, or one of its wallet's Realms. */
type Choice =
  | { kind: "ticket"; campaign: CampaignKey; golden: boolean }
  | {
      kind: "realm";
      realmId: number;
      map: string | null;
      name: string;
      order: number;
      resources: string[];
      wonder: string | null;
    };

const realmChoice = (held: HeldRealm): Choice => ({ kind: "realm", ...held, ...canonicalRealm(held.realmId) });
const valueOf = (choice: Choice) => (choice.kind === "ticket" ? "" : String(choice.realmId));

/** The ticket first (its home claims Essence on top of Labor), then the Realms: wonders first, the richest, by number. */
const choicesOf = (sources: HomeSources): Choice[] => [
  ...(sources.ticket ? [sources.ticket] : []),
  ...sources.realms.map(realmChoice).toSorted(byRealmOrder),
];

const byRealmOrder = (a: Choice, b: Choice) =>
  a.kind === "realm" && b.kind === "realm"
    ? Number(b.wonder !== null) - Number(a.wonder !== null) ||
      b.resources.length - a.resources.length ||
      a.realmId - b.realmId
    : 0;

const pickedChoice = (choices: Choice[], value: string) => choices.find((choice) => valueOf(choice) === value);

/**
 * Keeps the pick on a choice the step offers, and says whether it does. Once both reads are known, a pick none offers
 * (an empty one while Realms but no ticket are held, a Realm of another wallet) moves to the first choice: the ticket,
 * or else the first Realm. Nothing moves while settling or once a Realm is registered.
 */
function usePickOffered(
  choices: Choice[],
  ready: boolean,
  registered: number | null,
  value: string,
  onChange: (value: string) => void,
  disabled: boolean,
) {
  const first = choices[0] ? valueOf(choices[0]) : "";
  const offered = pickedChoice(choices, value) !== undefined || (value === "" && first === "");
  const settle = registered === null && !disabled && ready && !offered;
  useEffect(() => {
    if (settle) onChange(first);
  }, [settle, first, onChange]);
  return offered;
}

const choiceCount = (choices: Choice[]) =>
  HOME_STEP_WORDS.count(
    choices.filter((choice) => choice.kind === "ticket").length,
    choices.filter((choice) => choice.kind === "realm").length,
  );

/** The chosen home, large: its picture, its name, its traits and what it claims each day. */
function Featured({ choice, rules, locked }: { choice: Choice; rules: LaborRuleAmounts | null; locked: boolean }) {
  const claim = rules && homeSourceClaim(rules, sourceOf(choice));
  return (
    <div className="home-picker__featured" data-kind={choice.kind}>
      <ChoiceArt choice={choice} eager />
      <div className="home-picker__about">
        <h3>{choiceName(choice)}</h3>
        {choice.kind === "realm" ? (
          <>
            <p className="home-picker__sub">
              {HOME_STEP_WORDS.realm(choice.realmId)} · <OrderName order={choice.order} />
            </p>
            <Resources resources={choice.resources} />
            {choice.wonder && <Wonder wonder={choice.wonder} />}
          </>
        ) : (
          <p className="home-picker__sub">{choice.golden ? JOIN_WORDS.goldenLine : JOIN_WORDS.realm}</p>
        )}
        {claim && (
          <ul className="home-picker__claim">
            <li>
              <Icon name="labor" size={28} />
              {JOIN_WORDS.laborEachDay(claim.labor)}
            </li>
            {claim.essence > 0 && (
              <li>
                <Icon name="essence" size={28} />
                {JOIN_WORDS.essenceEachDay(claim.essence)}
              </li>
            )}
          </ul>
        )}
        {locked && <p className="home-picker__sub">{HOME_STEP_WORDS.registered}</p>}
      </div>
    </div>
  );
}

const sourceOf = (choice: Choice): HomeClaimSource =>
  choice.kind === "ticket" ? { kind: "campaign", golden: choice.golden } : { kind: "realm" };

const choiceName = (choice: Choice) =>
  choice.kind === "ticket" ? campaignTicketName(choice.campaign, choice.golden) : choice.name;

const choiceLabel = (choice: Choice) =>
  choice.kind === "ticket" ? choiceName(choice) : `${choice.realmId} · ${choice.name}`;

/**
 * The other choices: a strip of the first ones (three, two on a phone: what the doorway's width holds), then All,
 * which opens every choice in a grid with search. Each is a press; the chosen one is marked.
 */
function Choices({
  choices,
  value,
  onChange,
  disabled,
}: {
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const strip = useLayout() === "phone" ? 2 : 3;
  const [all, setAll] = useState(false);
  const pick = (choice: Choice) => {
    onChange(valueOf(choice));
    setAll(false);
  };
  const shown = choices.length > strip + 1 ? choices.slice(0, strip) : choices;
  return (
    <>
      <div className="home-picker__strip" role="group" aria-label={HOME_STEP_WORDS.title}>
        {shown.map((choice) => (
          <ChoiceButton
            key={valueOf(choice)}
            choice={choice}
            picked={valueOf(choice) === value}
            onPick={pick}
            disabled={disabled}
          />
        ))}
        {shown.length < choices.length && (
          <button
            type="button"
            className="home-picker__all"
            aria-expanded={all}
            onClick={() => setAll(!all)}
            disabled={disabled}
          >
            <Icon name="search" size={32} />
            {HOME_STEP_WORDS.all(choices.length)}
          </button>
        )}
      </div>
      {all && <AllChoices choices={choices} value={value} onPick={pick} disabled={disabled} />}
    </>
  );
}

/** Every choice in a grid, searched by name or number; maps load as their cards scroll into view. */
function AllChoices({
  choices,
  value,
  onPick,
  disabled,
}: {
  choices: Choice[];
  value: string;
  onPick: (choice: Choice) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const realms = choices.filter((choice) => choice.kind === "realm").length;
  const found = choices.filter((choice) => matches(choice, query));
  return (
    <div className="home-picker__allgrid">
      <label className="home-picker__search">
        <Icon name="search" size={22} />
        <input
          type="search"
          value={query}
          placeholder={HOME_STEP_WORDS.search(realms)}
          aria-label={HOME_STEP_WORDS.search(realms)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {found.length === 0 ? (
        <p className="home-picker__sub">{HOME_STEP_WORDS.noMatch}</p>
      ) : (
        <div className="home-picker__grid">
          {found.map((choice) => (
            <ChoiceButton
              key={valueOf(choice)}
              choice={choice}
              picked={valueOf(choice) === value}
              onPick={onPick}
              disabled={disabled}
              traits
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A search matches a Realm's name, or the start of its number; the ticket always shows. */
const matches = (choice: Choice, query: string) => {
  const asked = query.trim().toLowerCase();
  if (asked === "" || choice.kind === "ticket") return true;
  return choice.name.toLowerCase().includes(asked) || String(choice.realmId).startsWith(asked);
};

function ChoiceButton({
  choice,
  picked,
  onPick,
  disabled,
  traits = false,
}: {
  choice: Choice;
  picked: boolean;
  onPick: (choice: Choice) => void;
  disabled: boolean;
  traits?: boolean;
}) {
  return (
    <button
      type="button"
      className="home-picker__choice"
      aria-pressed={picked}
      aria-label={choiceLabel(choice)}
      onClick={() => onPick(choice)}
      disabled={disabled}
    >
      <ChoiceArt choice={choice} />
      <span className="home-picker__caption">{choiceLabel(choice)}</span>
      {traits && choice.kind === "realm" && (
        <span className="home-picker__traits">
          <Resources resources={choice.resources} />
          {choice.wonder && <Wonder wonder={choice.wonder} />}
        </span>
      )}
    </button>
  );
}

/** A Realm's map from the Realm index (fetched once it nears the screen), or a ticket's realm painting on its colour. */
function ChoiceArt({ choice, eager = false }: { choice: Choice; eager?: boolean }) {
  if (choice.kind === "ticket")
    return (
      <span className="home-picker__art" data-ticket={choice.golden ? "golden" : "regular"}>
        <Icon name={realmSkinIcon(choice.golden ? "devcon-golden" : "devcon")} size={112} />
      </span>
    );
  return (
    <span className="home-picker__art" data-map={choice.map ? "drawn" : "none"}>
      {choice.map ? (
        <img className="home-picker__map" src={choice.map} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <Icon name="realm" size={72} />
      )}
    </span>
  );
}

const OrderName = ({ order }: { order: number }) => (
  <span className="home-picker__order">
    <Icon name={orderMeaning(order)} size={20} />
    {orders.find((entry) => entry.orderId === order)?.fullOrderName}
  </span>
);

const Resources = ({ resources }: { resources: string[] }) => (
  <span className="home-picker__resources">
    {resources.map((resource) => (
      <Icon key={resource} name={mintedResourceMeaning(resource)} size={24} alt={resource} />
    ))}
  </span>
);

const Wonder = ({ wonder }: { wonder: string }) => (
  <span className="home-picker__wonder">
    <Icon name="star" size={16} />
    {wonder}
  </span>
);

/** Holding neither a ticket nor a Realm: the free home, and the way to the wallet that may hold some. */
function FreeHome({ unlinked }: { unlinked: boolean }) {
  return (
    <div className="home-picker__featured" data-kind="free">
      <span className="home-picker__art" data-ticket="free">
        <Icon name="realm" size={96} />
      </span>
      <div className="home-picker__about">
        <h3>{HOME_STEP_WORDS.freeHome}</h3>
        <p className="home-picker__sub">{HOME_STEP_WORDS.freeHomeLine}</p>
        {unlinked && <LinkWallet />}
      </div>
    </div>
  );
}

/** To the payout wallet in Settings, and back here once one is linked: the wallet that may hold the player's Realms. */
function LinkWallet() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      type="button"
      className="home-picker__link"
      onClick={() => navigate(linkWalletHref(returnPathOf(location)))}
    >
      {HOME_STEP_WORDS.linkWallet}
    </button>
  );
}

/**
 * The ticket or the Realms could not be read: say so, and read them again on demand. Nothing is offered or founded
 * around a failed read, and never a number to type instead.
 */
const Unreadable = ({ line, retry }: { line: string; retry: () => void }) => (
  <p className="home-picker__notice" role="status">
    {line}
    <button type="button" className="home-picker__link" onClick={retry}>
      {TRY_AGAIN}
    </button>
  </p>
);

/** What the step needs before it offers anything: the account's ticket, its wallet's Realms and the preset's rules. */
interface HomeSources {
  wallet: string | null;
  ticket: Choice | null;
  realms: HeldRealm[];
  /**
   * Both reads answered: the step can offer its choices and settle the pick. A failed read is not an answer: a holder's
   * Realms or ticket that could not be read must not become a free home or a lesser default.
   */
  ready: boolean;
  /** Ask the Realms again: set while they could not be read. */
  realmsUnreadable: (() => void) | null;
  /** Ask the ticket again: set while it could not be read. */
  ticketUnreadable: (() => void) | null;
  rules: LaborRuleAmounts | null;
}

function useHomeSources(presetId: number): HomeSources {
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
  const heldKnown = wallet === null || held.data !== undefined;
  const ticketKnown = campaign === null || ticket.data !== undefined;
  return {
    wallet,
    ticket: campaign && ticket.data ? { kind: "ticket", campaign, golden: ticket.data.tier === "golden" } : null,
    realms: held.data ?? [],
    ready: session !== null && heldKnown && ticketKnown,
    realmsUnreadable: held.isError ? () => void held.refetch() : null,
    ticketUnreadable: ticket.isError ? () => void ticket.refetch() : null,
    rules,
  };
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
