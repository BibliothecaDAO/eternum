import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { iconDefinition, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { toast } from "@/ui/features/event-feed/notify";
import { computeTravelTime, configManager, ResourceManager } from "@bibliothecadao/eternum";
import { EntityType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
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
/** The donkeys' road time: the travel helper counts whole minutes. */
const travelText = (minutes: number) => (minutes < 1 ? "under a minute" : `${minutes} min`);

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

const TransferSurface = ({ initial }: { initial: TransferEnds }) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  return (
    <SurfaceFrame
      title="Transfer"
      icon={"transfer" as const}
      onClose={closeSurface}
      className={SURFACE_WORKSPACE_CLASS}
      bodyClassName="lg:overflow-hidden"
    >
      <TransferWindow initial={initial} />
    </SurfaceFrame>
  );
};

/**
 * Send from, Send to (one or several) and what goes to each: side by side on a wide screen, one under the other in a
 * phone's sheet, which scrolls. Logistics' other views are a click away.
 */
const TransferWindow = ({ initial }: { initial: TransferEnds }) => {
  const [draft, setDraft] = useState<Draft>({ ends: initial, edited: null, revision: 0 });
  const { ends } = draft;
  // A new source, or swapped ends, start their own amounts.
  const change = (next: Partial<Omit<Draft, "revision">>) => setDraft((current) => revised(current, next));
  return (
    <div className="flex flex-col gap-2 p-3 lg:h-full lg:min-h-0">
      <LogisticsLinks />
      <div className="flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[250px_auto_250px_1fr]">
        <HoldingPicker
          title="Send from"
          chosen={ends.sourceId === null ? [] : [ends.sourceId]}
          otherEnd={ends.destinationIds}
          onPick={(id) => change({ ends: pickSource(ends, id), edited: null })}
          note={(id) => <DonkeysNote id={id} />}
        />
        <button
          type="button"
          aria-label="Swap from and to"
          title="Swap from and to"
          disabled={ends.destinationIds.length !== 1}
          onClick={() => change({ ends: swapEnds(ends), edited: null })}
          className="self-center rounded border border-gold/40 px-2 py-1 text-gold disabled:opacity-40 max-lg:rotate-90"
        >
          ⇄
        </button>
        <HoldingPicker
          title="Send to"
          chosen={ends.destinationIds}
          otherEnd={ends.sourceId === null ? [] : [ends.sourceId]}
          onPick={(id) => change({ ends: toggleDestination(ends, id) })}
          note={(id) => <RoadNote sourceId={ends.sourceId} id={id} />}
        />
        <div className="flex min-h-0 flex-col gap-3">
          {ends.sourceId !== null && (
            <Goods
              key={ends.sourceId}
              sourceId={ends.sourceId}
              destinationIds={ends.destinationIds}
              edited={draft.edited}
              revision={draft.revision}
              focus={initial.resource}
              onPlans={(edited) => change({ edited })}
              onSettled={(sentRevision, refused, goods) =>
                setDraft((current) => settled(current, sentRevision, refused, goods))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** Arrivals, Automation and Balances live in Logistics; the window links to them, Arrivals with what is on its way. */
const LogisticsLinks = () => {
  const arriving = useUIStore((state) => state.arrivedArrivalsNumber + state.pendingArrivalsNumber);
  const open = (tab: "arrivals" | "automation" | "balances") => () => {
    usePopoverStore.getState().closeSurface();
    useUIStore.getState().setLogisticsActiveTab(tab);
    useUIStore.getState().setLeftNavigationView(LeftView.ResourceArrivals);
  };
  return (
    <nav aria-label="Logistics" className="flex justify-end gap-3 text-sm">
      <button type="button" onClick={open("arrivals")} className="text-gold underline">
        Arrivals{arriving > 0 ? ` (${arriving})` : ""}
      </button>
      <button type="button" onClick={open("automation")} className="text-gold underline">
        Automation
      </button>
      <button type="button" onClick={open("balances")} className="text-gold underline">
        Balances
      </button>
    </nav>
  );
};

/** A source row's note: the donkeys there, which carry everything it sends. */
const DonkeysNote = ({ id }: { id: number }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const donkeys = new ResourceManager(setup.store, id).balanceWithProduction(tick, ResourcesIds.Donkey)?.balance ?? 0;
  return <>{amountText(Math.floor(Number(donkeys) / RESOURCE_PRECISION))} donkeys</>;
};

/** A destination row's note: the donkeys' road from the source. */
const RoadNote = ({ sourceId, id }: { sourceId: number | null; id: number }) => {
  const { setup } = useGame();
  if (sourceId === null) return null;
  const minutes = computeTravelTime(sourceId, id, configManager.getSpeedConfig(EntityType.DONKEY), setup.store);
  return <>{minutes === undefined ? null : travelText(minutes)}</>;
};

/**
 * What the source can send: one total per good, shared by the destinations (the owner's prefill until the player
 * edits), the road, and the one Send. Each destination's shipment lands or fails on its own, and the outcome settles
 * the draft it was sent from (`settled`).
 */
const Goods = ({
  sourceId,
  destinationIds,
  edited,
  revision,
  focus,
  onPlans,
  onSettled,
}: {
  sourceId: number;
  destinationIds: number[];
  edited: Plans | null;
  revision: number;
  focus: number | undefined;
  onPlans: (plans: Plans) => void;
  /** A send's outcome, with the draft revision it was sent from and the shipments refused. */
  onSettled: (sentRevision: number, refused: Shipment[], goods: Good[]) => void;
}) => {
  const sides = useTransferSides(sourceId, destinationIds);
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(5);
  const send = useSend();
  if (!sides) return null;
  // Until the player edits, the plans follow the owner's rules for the ends chosen now, so adding a rift adds donkeys.
  const plans =
    edited ?? plansOf(prefillTotals(sides.sourceRole, sides.destinationRoles, sides.goods, sides.donkeyCapacityKg));
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
          : `${travelText(sides.travelMinutes)} by donkey · ${amountText(donkeys)} of ${amountText(sides.donkeysHave)} donkeys`}
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
          minutes: sides.travelMinutes,
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
  minutes,
  donkeys,
  every,
}: {
  goods: number;
  destinations: number;
  minutes: number;
  donkeys: { needed: number; held: number };
  every: number | null;
}) => {
  if (destinations === 0) return "Choose where to send";
  if (goods === 0) return "Choose what to send";
  if (donkeys.needed > donkeys.held)
    return `Not enough donkeys: these loads need ${amountText(donkeys.needed)}, ${amountText(donkeys.held)} here`;
  const to = destinations > 1 ? ` to ${destinations} holdings` : "";
  const repeat = every === null ? "" : ` · every ${every} min`;
  return `Send ${goods} ${goods === 1 ? "good" : "goods"}${to} · on the road ${travelText(minutes)}${repeat}`;
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

/** One notice for what landed, and one for each shipment that did not, saying whether Send can try it again. */
const tellOutcomes = (outcomes: ShipmentOutcome[]) => {
  const landed = outcomes.filter((outcome) => outcome.status === "applied");
  if (landed.length > 0) toast.success(landed.length > 1 ? "Transfers sent." : "Transfer sent.");
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
        .toSorted((a, b) => a.resource - b.resource)
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
