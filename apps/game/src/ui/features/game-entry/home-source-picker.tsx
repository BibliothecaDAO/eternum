import "./home-source-picker.css";

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canonicalRealm } from "@bibliothecadao/eternum";
import { catalogOrder, type AspectId } from "@bibliothecadao/types";
import type { HeldRealm } from "@realms-world/identity";

import { useHeldRealms } from "@/hooks/use-holdings";
import { useLayout } from "@/shell/frame/layout";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { HomeArt } from "@/ui/shared/components/home-art";
import { aspectOfOrder } from "./aspect-picker";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { mintedResourceMeaning, orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudLoading } from "@/ui/design-system/kit/hud-elements";
import { HELD_REALMS_UNREADABLE, HOME_STEP_WORDS, TRY_AGAIN, numberedRealm } from "@/ui/design-system/kit/words";

export function HomeSourcePicker({
  registered,
  value,
  onChange,
  onSettled,
  disabled,
  title = HOME_STEP_WORDS.title,
  takenRealmIds = [],
  onSourceAvailable,
  requireSource = false,
  aspect = null,
}: {
  title?: string;
  requireSource?: boolean;
  /** The Aspect a founded home plays for, in a season with Aspects: only Realms of its Orders can attach to it. */
  aspect?: AspectId | null;
  takenRealmIds?: readonly number[];
  onSourceAvailable?: (available: boolean) => void;
  registered: number | null;
  value: string;
  onChange: (value: string) => void;
  onSettled: (settled: boolean) => void;
  disabled: boolean;
}) {
  const sources = useHomeSources();
  const choices = choicesOf(sources)
    .filter((choice) => aspect === null || aspectOfOrder(choice.order) === aspect)
    .map((choice) => ({ ...choice, taken: takenRealmIds.includes(choice.realmId) }));
  const available = choices.filter((choice) => !isTaken(choice));
  const hasSource = available.length > 0;
  const hasChoices = choices.length > 0;
  useEffect(() => {
    if (sources.ready) onSourceAvailable?.(hasChoices);
  }, [sources.ready, hasChoices, onSourceAvailable]);
  const offered = usePickOffered(available, sources.ready, registered, value, onChange, disabled);
  const settled = registered !== null || (sources.ready && offered && (!requireSource || hasSource));
  useEffect(() => {
    onSettled(settled);
  }, [settled, onSettled]);
  const picked = registered !== null ? realmChoice({ realmId: registered, map: null }) : pickedChoice(available, value);
  return (
    <section className="home-picker" aria-label={title}>
      <header className="home-picker__head">
        <h2>{title}</h2>
        {registered === null && choices.length > 0 && <span>{HOME_STEP_WORDS.count(choices.length)}</span>}
      </header>
      {picked ? (
        <Featured choice={picked} locked={registered !== null} />
      ) : sources.ready ? (
        <FreeHome unlinked={sources.wallet === null} />
      ) : sources.realmsUnreadable ? null : (
        <div className="home-picker__waiting">
          <HudLoading line={HOME_STEP_WORDS.loading} />
        </div>
      )}
      {registered === null && (choices.length > 1 || choices.some(isTaken)) && (
        <Choices choices={choices} value={value} onChange={onChange} disabled={disabled} />
      )}
      {registered === null && sources.ready && sources.wallet === null && choices.length > 0 && <LinkWallet />}
      {registered === null && sources.realmsUnreadable && (
        <Unreadable line={HELD_REALMS_UNREADABLE} retry={sources.realmsUnreadable} />
      )}
    </section>
  );
}

export type Choice = {
  kind: "realm";
  realmId: number;
  taken?: boolean;
  map: string | null;
  name: string;
  order: number;
  resources: string[];
  wonder: string | null;
};

export const realmChoice = (held: HeldRealm): Choice => ({ kind: "realm", ...held, ...canonicalRealm(held.realmId) });
const isTaken = (choice: Choice) => choice.taken === true;
const valueOf = (choice: Choice) => String(choice.realmId);

const choicesOf = (sources: HomeSources): Choice[] => sources.realms.map(realmChoice).toSorted(byRealmOrder);

const byRealmOrder = (a: Choice, b: Choice) =>
  Number(b.wonder !== null) - Number(a.wonder !== null) ||
  b.resources.length - a.resources.length ||
  a.realmId - b.realmId;

const pickedChoice = (choices: Choice[], value: string) => choices.find((choice) => valueOf(choice) === value);

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

function Featured({ choice, locked }: { choice: Choice; locked: boolean }) {
  return (
    <div className="home-picker__featured" data-kind="realm">
      <ChoiceArt choice={choice} eager />
      <div className="home-picker__about">
        <h3>{choice.name}</h3>
        <p className="home-picker__sub">
          {HOME_STEP_WORDS.realm(choice.realmId)} · <OrderName order={choice.order} />
        </p>
        <Resources resources={choice.resources} />
        {choice.wonder && <Wonder wonder={choice.wonder} />}
        {locked && <p className="home-picker__sub">{HOME_STEP_WORDS.registered}</p>}
      </div>
    </div>
  );
}

const choiceLabel = (choice: Choice) => numberedRealm(choice.realmId, choice.name);

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
  const realms = choices.length;
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

const matches = (choice: Choice, query: string) => {
  const asked = query.trim().toLowerCase();
  if (asked === "") return true;
  return choice.name.toLowerCase().includes(asked) || String(choice.realmId).startsWith(asked);
};

export function ChoiceButton({
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
      className="ui-pick home-picker__choice"
      aria-pressed={picked}
      aria-label={choiceLabel(choice)}
      onClick={() => onPick(choice)}
      disabled={disabled || isTaken(choice)}
    >
      <ChoiceArt choice={choice} />
      {picked && (
        <span className="home-picker__check" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      )}
      <span className="home-picker__caption">{choiceLabel(choice)}</span>
      {isTaken(choice) && <span>{HOME_STEP_WORDS.taken}</span>}
      {traits && (
        <span className="home-picker__traits">
          <Resources resources={choice.resources} />
          {choice.wonder && <Wonder wonder={choice.wonder} />}
        </span>
      )}
    </button>
  );
}

const ChoiceArt = ({ choice, eager = false }: { choice: Choice; eager?: boolean }) => (
  <HomeArt map={choice.map} icon="realm" size={72} eager={eager} />
);

const OrderName = ({ order }: { order: number }) => {
  const entry = catalogOrder(order);
  return (
    <span className="home-picker__order">
      {entry.aspect && <AspectMark aspect={entry.aspect} size={20} decorative />}
      <Icon name={orderMeaning(order)} size={20} />
      {entry.fullOrderName}
    </span>
  );
};

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

function FreeHome({ unlinked }: { unlinked: boolean }) {
  return (
    <div className="home-picker__featured" data-kind="free">
      <HomeArt icon="realm" size={96} />
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

const Unreadable = ({ line, retry }: { line: string; retry: () => void }) => (
  <p className="home-picker__notice" role="status">
    {line}
    <button type="button" className="home-picker__link" onClick={retry}>
      {TRY_AGAIN}
    </button>
  </p>
);

interface HomeSources {
  wallet: string | null;
  realms: HeldRealm[];
  ready: boolean;
  /** Ask the Realms again: set while they could not be read. */
  realmsUnreadable: (() => void) | null;
}

export function useNothingToChoose(): boolean {
  const sources = useHomeSources();
  return sources.ready && sources.realms.length === 0 && !sources.realmsUnreadable;
}

function useHomeSources(): HomeSources {
  const { session, wallet, held } = useHeldRealms();
  return {
    wallet,
    realms: held.data ?? [],
    ready: session !== null && (wallet === null || held.data !== undefined),
    realmsUnreadable: held.isError ? () => void held.refetch() : null,
  };
}
