import "./home-source-picker.css";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, aspects, catalogOrder, type AspectId } from "@bibliothecadao/types";
import type { HeldRealm } from "@realms-world/identity";

import { useHeldRealms } from "@/hooks/use-holdings";
import { useLayout } from "@/shell/frame/layout";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { mintedResourceMeaning, orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudLoading } from "@/ui/design-system/kit/hud-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import {
  HELD_REALMS_UNREADABLE,
  HOME_STEP_WORDS,
  REALM_SIDE_WORDS,
  TRY_AGAIN,
  numberedRealm,
} from "@/ui/design-system/kit/words";
import { HomeArt } from "@/ui/shared/components/home-art";

import { aspectOfOrder } from "./aspect-picker";

const DESKTOP_VAULT_MAX = 9;

export function HomeSourcePicker({
  registered,
  value,
  onChange,
  onSettled,
  disabled,
  title = "Found Your Home",
  takenRealmIds = [],
  onSourceAvailable,
  requireSource = false,
  aspect = null,
  action,
}: {
  title?: string;
  requireSource?: boolean;
  aspect?: AspectId | null;
  takenRealmIds?: readonly number[];
  onSourceAvailable?: (available: boolean) => void;
  registered: number | null;
  value: string;
  onChange: (value: string) => void;
  onSettled: (settled: boolean) => void;
  disabled: boolean;
  action?: ReactNode;
}) {
  const layout = useLayout();
  const desktop = layout === "desktop";
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
  const showChoices = registered === null && (choices.length > 1 || choices.some(isTaken));
  const splitDesktop = desktop && showChoices && picked !== undefined;
  return (
    <section data-home-picker className="home-picker" aria-label={title}>
      {!splitDesktop && (
        <header className="home-picker__top">
          <div className="home-picker__titles">
            <h2>{title}</h2>
            {registered === null && choices.length > 0 && (
              <p className="home-picker__subtitle">
                {`Pick one of your ${HOME_STEP_WORDS.count(choices.length)} for its quest bonus.`}
              </p>
            )}
          </div>
          {registered === null && choices.length > 0 && (
            <span className="home-picker__owned">
              <Icon name="realm" size={18} />
              {HOME_STEP_WORDS.count(choices.length)}
            </span>
          )}
        </header>
      )}
      <div className="home-picker__shell" data-split={splitDesktop || undefined}>
        {picked ? (
          <Featured choice={picked} locked={registered !== null} split={splitDesktop} action={action} />
        ) : sources.ready ? (
          <FreeHome unlinked={sources.wallet === null} action={action} />
        ) : sources.realmsUnreadable ? (
          action ? (
            <div className="home-picker__action">{action}</div>
          ) : null
        ) : (
          <>
            <div className="home-picker__waiting">
              <HudLoading line={HOME_STEP_WORDS.loading} />
            </div>
            {action && <div className="home-picker__action">{action}</div>}
          </>
        )}
        {showChoices && (
          <Choices
            title={splitDesktop ? title : undefined}
            choices={choices}
            value={value}
            onChange={onChange}
            disabled={disabled}
            desktop={desktop}
          />
        )}
      </div>
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

function Featured({
  choice,
  locked,
  split,
  action,
}: {
  choice: Choice;
  locked: boolean;
  split: boolean;
  action?: ReactNode;
}) {
  const entry = catalogOrder(choice.order);
  const aspect = entry.aspect ?? null;
  const aspectStyle = aspect !== null ? (aspectVariables(aspect) as CSSProperties) : undefined;
  return (
    <div className="home-picker__featured" data-kind="realm" style={aspectStyle}>
      {split && (
        <div className="home-picker__selected-head">
          <span className="home-picker__eyebrow">Selected Realm</span>
          <span className="home-picker__order-pill">
            <OrderEmblem order={choice.order} size={18} />
            {entry.orderName}
          </span>
        </div>
      )}
      <div className="home-picker__hero">
        <div className="home-picker__art-wrap">
          <ChoiceArt choice={choice} size={split ? 112 : 68} eager />
          {split && aspect !== null && (
            <span className="home-picker__facet-badge">
              <AspectMark aspect={aspect} size={32} decorative />
            </span>
          )}
        </div>
        <div className="home-picker__about">
          <div className="home-picker__name-row">
            <h3>{choice.name}</h3>
            {!split && <span className="home-picker__id">{`#${choice.realmId}`}</span>}
          </div>
          <div className="home-picker__meta">
            {split ? (
              <span>
                {`${HOME_STEP_WORDS.realm(choice.realmId)}`}
                {aspect !== null && (
                  <>
                    {" · "}
                    <span className="home-picker__aspect-label">{`Aspect of ${aspectName(aspect)}`}</span>
                  </>
                )}
              </span>
            ) : (
              <>
                {aspect !== null && (
                  <span className="home-picker__aspect-label">
                    <AspectMark aspect={aspect} size={18} decorative />
                    {aspectName(aspect)}
                  </span>
                )}
                <span className="home-picker__order">
                  <Icon name={orderMeaning(choice.order)} size={18} />
                  {entry.orderName}
                </span>
              </>
            )}
          </div>
          {choice.resources.length > 0 && <Resources resources={choice.resources} />}
          {choice.wonder && <Wonder wonder={choice.wonder} />}
          {locked && <p className="home-picker__sub">{HOME_STEP_WORDS.registered}</p>}
        </div>
      </div>
      <div className="home-picker__bonus">
        <span className="home-picker__bonus-label">{REALM_SIDE_WORDS.bonus}</span>
        <span className="home-picker__bonus-value">
          <Icon name="labor" size={18} />
        </span>
      </div>
      {action && <div className="home-picker__action">{action}</div>}
    </div>
  );
}

const choiceLabel = (choice: Choice) => numberedRealm(choice.realmId, choice.name);

function Choices({
  title,
  choices,
  value,
  onChange,
  disabled,
  desktop,
}: {
  title?: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  desktop: boolean;
}) {
  const [all, setAll] = useState(false);
  const [aspectFilter, setAspectFilter] = useState<AspectId | null>(null);
  const [query, setQuery] = useState("");
  const inlineVault = desktop && choices.length <= DESKTOP_VAULT_MAX;
  const strip = desktop ? 3 : 2;
  const pick = (choice: Choice) => {
    onChange(valueOf(choice));
    setAll(false);
  };
  const visible = inlineVault
    ? choices.filter((choice) => matchesFilter(choice, aspectFilter, query))
    : choices;
  const shown = inlineVault
    ? visible
    : choices.length > strip + 1
      ? choices.slice(0, strip)
      : choices;
  const countsByAspect = aspects
    .map((item) => ({
      id: item.id,
      name: item.name,
      count: choices.filter((choice) => catalogOrder(choice.order).aspect === item.id).length,
    }))
    .filter((item) => item.count > 0);
  return (
    <div className="home-picker__vault">
      <div className="home-picker__vault-head">
        {title ? (
          <div className="home-picker__titles">
            <h2>{title}</h2>
            <p className="home-picker__subtitle">
              {`Your Order decides your Aspect · ${HOME_STEP_WORDS.count(choices.length)}`}
            </p>
          </div>
        ) : (
          <span className="home-picker__eyebrow">{`Your Realms (${choices.length})`}</span>
        )}
        {inlineVault && (
          <label className="home-picker__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              placeholder={HOME_STEP_WORDS.search(choices.length)}
              aria-label={HOME_STEP_WORDS.search(choices.length)}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
      </div>
      {inlineVault && countsByAspect.length > 1 && (
        <AspectFilters
          total={choices.length}
          counts={countsByAspect}
          chosen={aspectFilter}
          onChoose={setAspectFilter}
        />
      )}
      {shown.length === 0 ? (
        <p className="home-picker__sub">{HOME_STEP_WORDS.noMatch}</p>
      ) : (
        <div className="home-picker__strip" role="group" aria-label={HOME_STEP_WORDS.title}>
          {shown.map((choice) => (
            <ChoiceButton
              key={valueOf(choice)}
              choice={choice}
              picked={valueOf(choice) === value}
              onPick={pick}
              disabled={disabled}
              desktop={inlineVault}
            />
          ))}
          {!inlineVault && shown.length < choices.length && (
            <button
              type="button"
              className="home-picker__all"
              aria-expanded={all}
              onClick={() => setAll(!all)}
              disabled={disabled}
            >
              <Icon name="search" size={24} />
              {HOME_STEP_WORDS.all(choices.length)}
            </button>
          )}
        </div>
      )}
      {all && <AllChoices choices={choices} value={value} onPick={pick} disabled={disabled} />}
    </div>
  );
}

const AspectFilters = ({
  total,
  counts,
  chosen,
  onChoose,
}: {
  total: number;
  counts: readonly { id: AspectId; name: string; count: number }[];
  chosen: AspectId | null;
  onChoose: (aspect: AspectId | null) => void;
}) => (
  <div className="home-picker__filters" role="group" aria-label="Filter by Aspect">
    <button
      type="button"
      className="home-picker__filter"
      aria-pressed={chosen === null}
      onClick={() => onChoose(null)}
    >
      {`All (${total})`}
    </button>
    {counts.map(({ id, name, count }) => (
      <button
        key={id}
        type="button"
        className="home-picker__filter"
        style={aspectVariables(id) as CSSProperties}
        aria-pressed={chosen === id}
        onClick={() => onChoose(chosen === id ? null : id)}
      >
        <AspectMark aspect={id} size={16} decorative />
        {`${name} (${count})`}
      </button>
    ))}
  </div>
);

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
  const [aspectFilter, setAspectFilter] = useState<AspectId | null>(null);
  const realms = choices.length;
  const countsByAspect = aspects
    .map((item) => ({
      id: item.id,
      name: item.name,
      count: choices.filter((choice) => catalogOrder(choice.order).aspect === item.id).length,
    }))
    .filter((item) => item.count > 0);
  const found = choices.filter((choice) => matchesFilter(choice, aspectFilter, query));
  return (
    <div className="home-picker__allgrid">
      <label className="home-picker__search">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={query}
          placeholder={HOME_STEP_WORDS.search(realms)}
          aria-label={HOME_STEP_WORDS.search(realms)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {countsByAspect.length > 1 && (
        <AspectFilters total={realms} counts={countsByAspect} chosen={aspectFilter} onChoose={setAspectFilter} />
      )}
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

const matchesFilter = (choice: Choice, aspectFilter: AspectId | null, query: string) => {
  if (aspectFilter !== null && catalogOrder(choice.order).aspect !== aspectFilter) return false;
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
  desktop = false,
}: {
  choice: Choice;
  picked: boolean;
  onPick: (choice: Choice) => void;
  disabled: boolean;
  traits?: boolean;
  desktop?: boolean;
}) {
  const entry = catalogOrder(choice.order);
  const aspect = entry.aspect ?? null;
  return (
    <button
      type="button"
      className="home-picker__choice"
      aria-pressed={picked}
      aria-label={choiceLabel(choice)}
      onClick={() => onPick(choice)}
      disabled={disabled || isTaken(choice)}
    >
      {picked && (
        <span className="home-picker__check" aria-hidden="true">
          <Icon name="check" size={12} />
        </span>
      )}
      {desktop || traits ? (
        <div className="home-picker__choice-art">
          <ChoiceArt choice={choice} size={64} />
        </div>
      ) : (
        <div className="home-picker__choice-top">
          <OrderEmblem order={choice.order} size={22} />
          <span className="home-picker__id">{`#${choice.realmId}`}</span>
        </div>
      )}
      <span className="home-picker__caption">{choice.name}</span>
      <span className="home-picker__choice-foot">
        <span className="home-picker__order">
          {desktop || traits ? (
            <>
              <Icon name={orderMeaning(choice.order)} size={16} />
              {entry.orderName}
            </>
          ) : (
            aspect !== null && (
              <>
                <AspectMark aspect={aspect} size={16} decorative />
                {aspectName(aspect)}
              </>
            )
          )}
        </span>
        {(desktop || traits) && <span className="home-picker__id">{`#${choice.realmId}`}</span>}
      </span>
      {isTaken(choice) && <span className="home-picker__id">{HOME_STEP_WORDS.taken}</span>}
      {traits && (choice.resources.length > 0 || choice.wonder) && (
        <span className="home-picker__traits">
          <Resources resources={choice.resources} />
          {choice.wonder && <Wonder wonder={choice.wonder} />}
        </span>
      )}
    </button>
  );
}

const ChoiceArt = ({ choice, size = 72, eager = false }: { choice: Choice; size?: number; eager?: boolean }) => (
  <HomeArt map={choice.map} icon="realm" size={size} eager={eager} />
);

const Resources = ({ resources }: { resources: string[] }) => (
  <span className="home-picker__resources">
    {resources.map((resource) => (
      <Icon key={resource} name={mintedResourceMeaning(resource)} size={20} alt={resource} />
    ))}
  </span>
);

const Wonder = ({ wonder }: { wonder: string }) => (
  <span className="home-picker__wonder">
    <Icon name="star" size={14} />
    {wonder}
  </span>
);

function FreeHome({ unlinked, action }: { unlinked: boolean; action?: ReactNode }) {
  return (
    <div className="home-picker__featured" data-kind="free">
      <div className="home-picker__hero">
        <div className="home-picker__art-wrap">
          <HomeArt icon="realm" size={64} />
        </div>
        <div className="home-picker__about">
          <h3>{HOME_STEP_WORDS.freeHome}</h3>
          <p className="home-picker__sub">{HOME_STEP_WORDS.freeHomeLine}</p>
          {unlinked && <LinkWallet />}
        </div>
      </div>
      {action && <div className="home-picker__action">{action}</div>}
    </div>
  );
}

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
