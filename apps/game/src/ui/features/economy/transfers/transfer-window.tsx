import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { iconDefinition, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { toast } from "@/ui/features/event-feed/notify";
import { ResourceArrivals } from "@/ui/features/economy/trading";
import { TransferAutomationAdvancedModal } from "@/ui/features/economy/transfers/transfer-automation-modal";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { deliveryLandsAt, isMilitaryResource, ResourceManager, shipmentTravelSeconds } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { resourcesInTierOrder } from "@/ui/shared/resource-tier-order";
import { BalancesView } from "./balances-view";
import { HoldingPicker } from "./holding-picker";
import { type Shipment, type ShipmentOutcome, sendShipments } from "./send-shipments";
import {
  donkeysNeeded,
  type Good,
  type GoodPlan,
  honouredShares,
  type Plans,
  plansOf,
  prefillTotals,
  sentTotal,
  sharesOf,
  withoutShare,
  withShare,
  withTotal,
} from "./transfer-plan";
import { type TransferSides, useTransferSides } from "./use-transfer-sides";

interface TransferEnds {
  sourceId: number | null;
  destinationIds: number[];
  /** The good it was opened for (a resource's own Transfer): its total is ready to type. */
  resource?: number;
}

/**
 * Opens the one transfer window, centred like every workspace. Every way in calls this: the Transfer bubble and T (the
 * active holding as the source), a holding's banner, and the map gesture (a holding selected, another right-clicked).
 */
export const openTransfer = (ends: TransferEnds) => {
  useUIStore.getState().setLeftNavigationView(LeftView.None);
  usePopoverStore.getState().openSurface({
    id: "transfer",
    content: (
      <TransferSurface
        key={`${ends.sourceId}:${ends.destinationIds.join(",")}:${ends.resource ?? ""}`}
        initial={ends}
      />
    ),
  });
};

const resourceName = (resource: number) => iconDefinition(resourceMeaning(resource)).label;
const amountText = (value: number) => value.toLocaleString("en-US");
/** When goods land, in whole minutes rounded up: never sooner than the chain lands them. */
const landsText = (seconds: number) =>
  seconds < 60 ? "lands in under a minute" : `lands in ${Math.ceil(seconds / 60)} min`;

/**
 * What the window is about to send: its ends, the amounts the player set (null while the owner's prefill stands), and
 * a revision every change bumps, so a send's outcome can tell whether the draft it was sent from is still the one shown.
 */
interface Draft {
  ends: TransferEnds;
  edited: Plans | null;
  revision: number;
}

const revised = (draft: Draft, change: Partial<Omit<Draft, "revision">>): Draft => ({
  ...draft,
  ...change,
  revision: draft.revision + 1,
});

/**
 * A send's outcome on the draft it was sent from: what landed leaves, and the refused shipments stay with exactly their
 * goods. A draft the player has changed since is theirs: the outcome leaves it as it is (its notices still say what
 * landed).
 */
const settled = (draft: Draft, sentRevision: number, refused: Shipment[], goods: Good[]): Draft =>
  draft.revision !== sentRevision
    ? draft
    : revised(draft, {
        ends: { ...draft.ends, destinationIds: refused.map((shipment) => shipment.destinationId) },
        edited: plansFor(refused, goods),
      });

/** The ends after a pick: a source moves off the destinations; a destination toggles. */
const pickSource = (ends: TransferEnds, id: number): TransferEnds => ({
  sourceId: id,
  destinationIds: ends.destinationIds.filter((destination) => destination !== id),
});
const toggleDestination = (ends: TransferEnds, id: number): TransferEnds => ({
  ...ends,
  destinationIds: ends.destinationIds.includes(id)
    ? ends.destinationIds.filter((destination) => destination !== id)
    : [...ends.destinationIds, id],
});
const swapEnds = (ends: TransferEnds): TransferEnds =>
  ends.destinationIds.length === 1 && ends.sourceId !== null
    ? { sourceId: ends.destinationIds[0], destinationIds: [ends.sourceId] }
    : ends;

/** A view tab in the HUD's title type; the lit one (gold hairline on a gold wash) is the view shown. */
const VIEW_TAB = cn(
  HUD_LABEL,
  "!mx-0 min-h-11 flex items-center justify-center rounded-md border border-gold/20 bg-black/25 px-3 transition hover:border-gold/45 data-[selected]:border-gold/70 data-[selected]:bg-gold/15",
);

/**
 * The one transfer window: sending, and what is on its way, the repeating transfers and every holding's balances,
 * each a tab of it (Transfer · Arrivals · Automation · Balances). It opens on Transfer.
 */
const TransferSurface = ({ initial }: { initial: TransferEnds }) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const showAutomation = useGameModeConfig().ui.showAutomation;
  return (
    <SurfaceFrame
      title="Transfer"
      icon={"transfer" as const}
      onClose={closeSurface}
      className={SURFACE_WORKSPACE_CLASS}
      bodyClassName="lg:overflow-hidden"
    >
      <Tabs className="flex flex-col gap-2 p-3 lg:h-full lg:min-h-0">
        <Tabs.List
          aria-label="Transfer views"
          className={cn("grid gap-1", showAutomation ? "grid-cols-4" : "grid-cols-3")}
        >
          <Tabs.Tab className={VIEW_TAB}>Transfer</Tabs.Tab>
          <Tabs.Tab className={VIEW_TAB}>
            Arrivals
            <ArrivalsBadge />
          </Tabs.Tab>
          {showAutomation && <Tabs.Tab className={VIEW_TAB}>Automation</Tabs.Tab>}
          <Tabs.Tab className={VIEW_TAB}>Balances</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panels className="lg:min-h-0 lg:flex-1">
          <Tabs.Panel className="lg:h-full">
            <TransferWindow initial={initial} />
          </Tabs.Panel>
          <Tabs.Panel className="lg:h-full lg:overflow-y-auto">
            <ArrivalsView />
          </Tabs.Panel>
          {showAutomation && (
            <Tabs.Panel className="lg:h-full lg:overflow-y-auto">
              <TransferAutomationAdvancedModal />
            </Tabs.Panel>
          )}
          <Tabs.Panel className="lg:h-full lg:overflow-hidden">
            <BalancesView />
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </SurfaceFrame>
  );
};

/** What is on its way to the player's holdings: green once some is ready to claim, gold while all is on the road. */
const ArrivalsBadge = () => {
  const arrived = useUIStore((state) => state.arrivedArrivalsNumber);
  const pending = useUIStore((state) => state.pendingArrivalsNumber);
  if (arrived + pending === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
        arrived > 0 ? "bg-progress-bar-good/90 text-dark" : "bg-gold/90 text-dark",
      )}
      title={`${arrived} ready · ${pending} pending`}
    >
      {arrived + pending}
    </span>
  );
};

const ArrivalsView = () => {
  const arriving = useUIStore((state) => state.arrivedArrivalsNumber + state.pendingArrivalsNumber);
  return <ResourceArrivals hasArrivals={arriving > 0} />;
};

/**
 * Send from, Send to (one or several) and what goes to each: side by side on a wide screen, one under the other in a
 * phone's sheet, which scrolls. Logistics' other views are a click away.
 */
const TransferWindow = ({ initial }: { initial: TransferEnds }) => {
  const [draft, setDraft] = useState<Draft>({ ends: initial, edited: null, revision: 0 });
  const { ends } = draft;
  const sides = useTransferSides(ends.sourceId, ends.destinationIds);
  // Until the player edits, the plans follow the owner's rules for the ends chosen now, so adding a rift adds donkeys.
  const plans = sides ? (draft.edited ?? prefilledPlans(sides)) : null;
  const landsIn = useLandings(ends, sides, plans);
  // A new source, or swapped ends, start their own amounts.
  const change = (next: Partial<Omit<Draft, "revision">>) => setDraft((current) => revised(current, next));
  return (
    <div className="flex flex-col gap-3 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[260px_auto_260px_1fr]">
      {/* Each column uses the shared HUD panel. */}
      <InfoBubble className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col py-2">
        <HoldingPicker
          title="Send from"
          chosen={ends.sourceId === null ? [] : [ends.sourceId]}
          otherEnd={ends.destinationIds}
          onPick={(id) => change({ ends: pickSource(ends, id), edited: null })}
          note={(id) => <DonkeysNote id={id} />}
        />
      </InfoBubble>
      {/* Closed until one holding is chosen to send to, and it looks closed and says so. */}
      <button
        type="button"
        aria-label="Swap from and to"
        title={ends.destinationIds.length === 1 ? "Swap from and to" : "Choose one holding to send to, then swap"}
        disabled={ends.destinationIds.length !== 1}
        onClick={() => change({ ends: swapEnds(ends), edited: null })}
        className="self-center rounded border border-gold/40 px-2 py-1 text-gold disabled:cursor-not-allowed disabled:border-gold/10 disabled:text-gold/25 max-lg:rotate-90"
      >
        ⇄
      </button>
      <InfoBubble className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col py-2">
        <HoldingPicker
          title="Send to"
          chosen={ends.destinationIds}
          otherEnd={ends.sourceId === null ? [] : [ends.sourceId]}
          onPick={(id) => change({ ends: toggleDestination(ends, id) })}
          note={(id) => {
            const seconds = landsIn(id);
            return seconds === undefined ? null : landsText(seconds);
          }}
        />
      </InfoBubble>
      <InfoBubble className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col gap-3 py-2">
        {ends.sourceId !== null && sides && plans && (
          <Goods
            key={ends.sourceId}
            sourceId={ends.sourceId}
            destinationIds={ends.destinationIds}
            sides={sides}
            plans={plans}
            landsIn={Math.max(0, ...ends.destinationIds.map((id) => landsIn(id) ?? 0))}
            revision={draft.revision}
            focus={initial.resource}
            onPlans={(edited) => change({ edited })}
            onSettled={(sentRevision, refused, goods) =>
              setDraft((current) => settled(current, sentRevision, refused, goods))
            }
          />
        )}
      </InfoBubble>
    </div>
  );
};

/** A source row's note: the donkeys there, which carry everything it sends. */
const DonkeysNote = ({ id }: { id: number }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const donkeys = new ResourceManager(setup.store, id).balanceWithProduction(tick, ResourcesIds.Donkey)?.balance ?? 0;
  return <>{amountText(Math.floor(Number(donkeys) / RESOURCE_PRECISION))} donkeys</>;
};

/** The owner's prefill for the ends chosen now: realm to rifts, rift to realms, camp to realms. */
const prefilledPlans = (sides: TransferSides): Plans =>
  plansOf(prefillTotals(sides.sourceRole, sides.destinationRoles, sides.goods, sides.donkeyCapacityKg));

/** Whether a destination's shipment carries troops, which slow its donkeys. */
const troopsAboard = (sides: TransferSides, plans: Plans, destinationIds: number[], index: number) =>
  sides.goods.some(
    (good) =>
      isMilitaryResource(good.resource) && sharesOf(plans.get(good.resource), destinationIds, good.have)[index] > 0,
  );

/**
 * Seconds until goods land at a holding, from one chain clock and the chain's own rules: a chosen destination by its
 * shipment as planned (troops aboard ride slower), any other holding by goods sent there now. Every place the window
 * says when goods land reads this, so a destination's note and Send never promise different landings.
 */
const useLandings = (ends: TransferEnds, sides: TransferSides | null, plans: Plans | null) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  return (id: number): number | undefined => {
    if (ends.sourceId === null) return undefined;
    const index = ends.destinationIds.indexOf(id);
    const troops =
      index >= 0 && sides !== null && plans !== null && troopsAboard(sides, plans, ends.destinationIds, index);
    const road = shipmentTravelSeconds(ends.sourceId, id, setup.store, troops);
    return road === undefined ? undefined : deliveryLandsAt(now, road) - now;
  };
};

/**
 * What the source can send: one total per good, shared by the destinations (the owner's prefill until the player
 * edits), the road, and the one Send. Each destination's shipment lands or fails on its own, and the outcome settles
 * the draft it was sent from (`settled`).
 */
const Goods = ({
  sourceId,
  destinationIds,
  sides,
  plans,
  landsIn,
  revision,
  focus,
  onPlans,
  onSettled,
}: {
  sourceId: number;
  destinationIds: number[];
  sides: TransferSides;
  plans: Plans;
  /** Seconds until the last shipment lands (useLandings). */
  landsIn: number;
  revision: number;
  focus: number | undefined;
  onPlans: (plans: Plans) => void;
  /** A send's outcome, with the draft revision it was sent from and the shipments refused. */
  onSettled: (sentRevision: number, refused: Shipment[], goods: Good[]) => void;
}) => {
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(5);
  const send = useSend();
  const donkeys = donkeysNeeded(plans, sides.goods, destinationIds, sides.donkeyCapacityKg);
  const chosen = sides.goods.filter((good) => sentTotal(plans.get(good.resource), good.have) > 0).length;
  const short = donkeys > sides.donkeysHave;

  const sendNow = async () => {
    const sentRevision = revision;
    const outcomes = await send.run({ sourceId, destinationIds, sides, plans, interval: repeat ? interval : null });
    if (outcomes.length === 0) return;
    const refused = outcomes.flatMap((outcome) => (outcome.status === "refused" ? [outcome.shipment] : []));
    onSettled(sentRevision, refused, sides.goods);
  };

  return (
    <>
      <p className="text-sm text-kit-muted">
        {destinationIds.length === 0
          ? `${amountText(sides.donkeysHave)} donkeys at ${sides.sourceName} · pick where to send`
          : `${landsText(landsIn)} · ${amountText(donkeys)} of ${amountText(sides.donkeysHave)} donkeys`}
      </p>
      <GoodsGrid
        goods={sides.goods}
        plans={plans}
        destinationIds={destinationIds}
        destinationNames={sides.destinationNames}
        focus={focus}
        onPlan={(resource, plan) => onPlans(new Map(plans).set(resource, plan))}
      />
      <button
        type="button"
        disabled={chosen === 0 || destinationIds.length === 0 || short || send.busy}
        onClick={() => void sendNow()}
        className="rounded-md bg-gold px-4 py-3 text-base font-semibold text-kit-ink disabled:opacity-50"
      >
        {sendWords({
          goods: chosen,
          destinations: destinationIds.length,
          landsIn,
          donkeys: { needed: donkeys, held: sides.donkeysHave },
          every: repeat ? interval : null,
        })}
      </button>
      <label className="flex items-center gap-2 text-sm text-kit-muted">
        <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} /> Repeat
        {repeat && (
          <>
            every
            <input
              aria-label="Minutes between runs"
              type="number"
              min={1}
              max={30}
              value={interval}
              onChange={(event) => setInterval(Math.min(30, Math.max(1, Number(event.target.value))))}
              className="w-14 rounded border border-gold/30 bg-black/40 px-1 text-right"
            />
            min (Automation lists it)
          </>
        )}
      </label>
    </>
  );
};

/** The plans that send the refused shipments again, each destination's goods exactly as they were. */
const plansFor = (refused: Shipment[], goods: Good[]): Plans => {
  const plans: Plans = new Map();
  for (const good of goods) {
    const shares = new Map(
      refused.map((shipment) => [
        shipment.destinationId,
        shipment.lines.find((line) => line.resource === good.resource)?.amount ?? 0,
      ]),
    );
    const total = [...shares.values()].reduce((sum, share) => sum + share, 0);
    if (total > 0) plans.set(good.resource, { total, pinned: refused.length > 1 ? shares : new Map() });
  }
  return plans;
};

/**
 * The Send button's words: what leaves, to how many, and when it lands; or, while it is closed, what is still to
 * choose or what keeps it closed. Never an error: the window has had no action to answer yet, and the owner's prefill
 * alone can ask for more donkeys than the source holds.
 */
const sendWords = ({
  goods,
  destinations,
  landsIn,
  donkeys,
  every,
}: {
  goods: number;
  destinations: number;
  landsIn: number;
  donkeys: { needed: number; held: number };
  every: number | null;
}) => {
  if (destinations === 0) return "Choose where to send";
  if (goods === 0) return "Choose what to send";
  if (donkeys.needed > donkeys.held)
    return `Not enough donkeys: these loads need ${amountText(donkeys.needed)}, ${amountText(donkeys.held)} here`;
  const to = destinations > 1 ? ` to ${destinations} holdings` : "";
  const repeat = every === null ? "" : ` · every ${every} min`;
  return `Send ${goods} ${goods === 1 ? "good" : "goods"}${to} · ${landsText(landsIn)}${repeat}`;
};

/** Each destination's goods in whole units, as much as the source holds now. */
const shipments = (destinationIds: number[], destinationNames: string[], goods: Good[], plans: Plans): Shipment[] =>
  destinationIds
    .map((destinationId, index) => ({
      destinationId,
      destinationName: destinationNames[index],
      lines: goods
        .map((good) => ({
          resource: good.resource,
          amount: sharesOf(plans.get(good.resource), destinationIds, good.have)[index],
        }))
        .filter((line) => line.amount > 0),
    }))
    .filter((shipment) => shipment.lines.length > 0);

/**
 * Sends a transfer, one shipment per destination, and says how each ended. With an interval, each shipment that
 * landed also becomes a repeating transfer in Automation, already run once now.
 */
const useSend = () => {
  const {
    setup: { systemCalls },
    account: { account },
  } = useGame();
  const addScheduled = useTransferAutomationStore((state) => state.add);
  const [busy, setBusy] = useState(false);
  const run = async ({
    sourceId,
    destinationIds,
    sides,
    plans,
    interval,
  }: {
    sourceId: number;
    destinationIds: number[];
    sides: TransferSides;
    plans: Plans;
    interval: number | null;
  }): Promise<ShipmentOutcome[]> => {
    const loads = shipments(destinationIds, sides.destinationNames, sides.goods, plans);
    if (loads.length === 0) return [];
    setBusy(true);
    try {
      const outcomes = await sendShipments(sourceId, loads, (call) =>
        systemCalls.send_resources_multiple({ signer: account, calls: [call] }),
      );
      const landed = outcomes.flatMap((outcome) => (outcome.status === "applied" ? [outcome.shipment] : []));
      if (interval !== null) scheduleRepeats(addScheduled, sourceId, sides.sourceName, landed, interval);
      tellOutcomes(outcomes);
      return outcomes;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
};

/** One notice for each shipment that did not land, saying whether Send can try it again; a sent one is its own row. */
const tellOutcomes = (outcomes: ShipmentOutcome[]) => {
  for (const outcome of outcomes) {
    const to = outcome.shipment.destinationName;
    if (outcome.status === "refused")
      toast.failed(outcome.error, "The game refused it.", { description: `Nothing reached ${to}.` });
    if (outcome.status === "unknown")
      toast.warning(`No answer for ${to} yet: it may still arrive. Check Arrivals before sending it again.`);
    if (outcome.status === "busy") toast.warning(`A transfer to ${to} is still on its way to the chain.`);
  }
};

/** Each shipment that landed as a repeating transfer in Automation, already run once now. */
const scheduleRepeats = (
  addScheduled: ReturnType<typeof useTransferAutomationStore.getState>["add"],
  sourceId: number,
  sourceName: string,
  landed: Shipment[],
  interval: number,
) => {
  const now = Date.now();
  landed.forEach((shipment) =>
    addScheduled({
      sourceEntityId: String(sourceId),
      sourceName,
      destinationEntityId: String(shipment.destinationId),
      destinationName: shipment.destinationName,
      resourceIds: shipment.lines.map((line) => line.resource),
      resourceConfigs: shipment.lines.map((line) => ({ resourceId: line.resource, amount: line.amount })),
      intervalMinutes: interval,
      active: true,
      lastRunAt: now,
    }),
  );
};

const NUMBER_INPUT = "w-full rounded border bg-black/40 px-2 py-1 text-right disabled:opacity-40";

/**
 * Every good the source holds, by resource id: what it has, the total to send (Max sends it all), and with several
 * destinations each one's share, split evenly; a share typed by hand stays (gold), and ↺ returns it to the split.
 */
const GoodsGrid = ({
  goods,
  plans,
  destinationIds,
  destinationNames,
  focus,
  onPlan,
}: {
  goods: Good[];
  plans: Plans;
  destinationIds: number[];
  destinationNames: string[];
  focus: number | undefined;
  onPlan: (resource: number, plan: GoodPlan) => void;
}) => {
  const several = destinationIds.length > 1;
  const template = `minmax(7rem,1fr) 4rem 5rem 2.5rem${several ? ` repeat(${destinationIds.length}, 4.25rem)` : ""}`;
  // The goods sit as the holding's card shows them; one the card never shows comes last, by id.
  const tiers = useGameModeConfig().resources.getTiers() as Record<string, ResourcesIds[]>;
  const rank = new Map(resourcesInTierOrder(tiers).map((resource, index) => [Number(resource), index]));
  const cardOrder = (good: Good) => rank.get(good.resource) ?? Number.MAX_SAFE_INTEGER;
  return (
    <div role="table" aria-label="Goods" className="flex min-h-0 flex-col gap-1 overflow-auto">
      <div
        role="row"
        className="grid items-end gap-2 px-2 text-sm text-kit-muted"
        style={{ gridTemplateColumns: template }}
      >
        <span role="columnheader">Good</span>
        <span role="columnheader" className="text-right">
          Has
        </span>
        <span role="columnheader" className="text-right">
          Total
        </span>
        <span />
        {several &&
          destinationNames.map((name, index) => (
            <span key={destinationIds[index]} role="columnheader" className="truncate text-right" title={name}>
              {name}
            </span>
          ))}
      </div>
      {goods
        .toSorted((a, b) => cardOrder(a) - cardOrder(b) || a.resource - b.resource)
        .map((good) => (
          <GoodRow
            key={good.resource}
            good={good}
            plan={plans.get(good.resource)}
            destinationIds={destinationIds}
            destinationNames={destinationNames}
            template={template}
            focused={good.resource === focus}
            onPlan={(plan) => onPlan(good.resource, plan)}
          />
        ))}
    </div>
  );
};

const GoodRow = ({
  good,
  plan,
  destinationIds,
  destinationNames,
  template,
  focused,
  onPlan,
}: {
  good: Good;
  plan: GoodPlan | undefined;
  destinationIds: number[];
  destinationNames: string[];
  template: string;
  focused: boolean;
  onPlan: (plan: GoodPlan) => void;
}) => {
  const shares = sharesOf(plan, destinationIds, good.have);
  const honoured = honouredShares(plan, destinationIds, good.have);
  const name = resourceName(good.resource);
  return (
    <div
      role="row"
      className="grid items-center gap-2 rounded-md bg-black/30 px-2 py-1"
      style={{ gridTemplateColumns: template }}
    >
      <span className="flex items-center gap-2 truncate">
        <ResourceIcon resource={good.resource} size="sm" withTooltip={false} />
        {name}
      </span>
      <span className="text-right text-sm text-kit-muted">{amountText(good.have)}</span>
      <input
        aria-label={`${name}: total to send`}
        type="number"
        min={0}
        step={1}
        autoFocus={focused}
        value={sentTotal(plan, good.have)}
        onChange={(event) => onPlan(withTotal(plan, Number(event.target.value), good.have))}
        className={cn(NUMBER_INPUT, "border-gold/30")}
      />
      <button type="button" onClick={() => onPlan(withTotal(plan, good.have, good.have))} className="text-sm text-gold">
        Max
      </button>
      {destinationIds.length > 1 &&
        destinationIds.map((id, index) => {
          const pinned = honoured.has(id);
          return (
            <span key={id} className="relative">
              <input
                aria-label={`${name} to ${destinationNames[index]}`}
                type="number"
                min={0}
                step={1}
                value={shares[index]}
                onChange={(event) => onPlan(withShare(plan, id, Number(event.target.value), good.have, destinationIds))}
                className={cn(NUMBER_INPUT, pinned ? "border-gold text-gold" : "border-gold/20")}
              />
              {pinned && plan && (
                <button
                  type="button"
                  aria-label={`Split ${name} evenly again`}
                  title="Back to the even split"
                  onClick={() => onPlan(withoutShare(plan, id))}
                  className="absolute -right-1 -top-2 rounded bg-black px-1 text-sm text-gold"
                >
                  ↺
                </button>
              )}
            </span>
          );
        })}
    </div>
  );
};
