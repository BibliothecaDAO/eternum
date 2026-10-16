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
import {
  donkeysTaken,
  type Good,
  type GoodPlan,
  type Plans,
  plansOf,
  prefillTotals,
  sharesOf,
  withoutShare,
  withShare,
  withTotal,
} from "./transfer-plan";
import { type TransferSides, useTransferSides } from "./use-transfer-sides";

interface TransferEnds {
  sourceId: number | null;
  destinationIds: number[];
}

/**
 * Opens the one transfer window, centred like every workspace. Every way in calls this: the Transfer bubble and T (the
 * active holding as the source), a holding's banner, and the map gesture (a holding selected, another right-clicked).
 */
export const openTransfer = (ends: TransferEnds) => {
  useUIStore.getState().setLeftNavigationView(LeftView.None);
  usePopoverStore.getState().openSurface({
    id: "transfer",
    content: <TransferSurface key={`${ends.sourceId}:${ends.destinationIds.join(",")}`} initial={ends} />,
  });
};

const resourceName = (resource: number) => iconDefinition(resourceMeaning(resource)).label;
const amountText = (value: number) => value.toLocaleString("en-US");
/** The donkeys' road time: the travel helper counts whole minutes. */
const travelText = (minutes: number) => (minutes < 1 ? "under a minute" : `${minutes} min`);

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
      bodyClassName="overflow-hidden"
    >
      <TransferWindow initial={initial} />
    </SurfaceFrame>
  );
};

/** Send from, Send to (one or several) and what goes to each, side by side; Logistics' other views a click away. */
const TransferWindow = ({ initial }: { initial: TransferEnds }) => {
  const [ends, setEnds] = useState(initial);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <LogisticsLinks />
      <div className="grid min-h-0 flex-1 grid-cols-[250px_auto_250px_1fr] gap-3">
        <HoldingPicker
          title="Send from"
          chosen={ends.sourceId === null ? [] : [ends.sourceId]}
          otherEnd={ends.destinationIds}
          onPick={(id) => setEnds(pickSource(ends, id))}
          note={(id) => <DonkeysNote id={id} />}
        />
        <button
          type="button"
          aria-label="Swap from and to"
          title="Swap from and to"
          disabled={ends.destinationIds.length !== 1}
          onClick={() => setEnds(swapEnds(ends))}
          className="self-center rounded border border-gold/40 px-2 py-1 text-gold disabled:opacity-40"
        >
          ⇄
        </button>
        <HoldingPicker
          title="Send to"
          chosen={ends.destinationIds}
          otherEnd={ends.sourceId === null ? [] : [ends.sourceId]}
          onPick={(id) => setEnds(toggleDestination(ends, id))}
          note={(id) => <RoadNote sourceId={ends.sourceId} id={id} />}
        />
        <div className="flex min-h-0 flex-col gap-3">
          {ends.sourceId !== null && (
            <Goods key={ends.sourceId} sourceId={ends.sourceId} destinationIds={ends.destinationIds} />
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
 * What the source can send: one total per good, shared evenly by the destinations (the owner's prefill until the
 * player edits), the road, and the one Send.
 */
const Goods = ({ sourceId, destinationIds }: { sourceId: number; destinationIds: number[] }) => {
  const sides = useTransferSides(sourceId, destinationIds);
  const [edited, setEdited] = useState<Plans | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(5);
  const send = useSend();
  if (!sides) return null;
  // Until the player edits, the plans follow the owner's rules for the ends chosen now, so adding a rift adds donkeys.
  const plans = edited ?? plansOf(prefillTotals(sides.sourceRole, sides.destinationRoles, sides.goods));
  const donkeys = donkeysTaken(plans, sides.goods, destinationIds, sides.donkeyCapacityKg);
  const chosen = sides.goods.filter((good) => (plans.get(good.resource)?.total ?? 0) > 0).length;
  const short = donkeys > sides.donkeysHave;

  return (
    <>
      <p className={cn("text-sm", short ? "text-red-300" : "text-kit-muted")}>
        {destinationIds.length === 0
          ? `${amountText(sides.donkeysHave)} donkeys at ${sides.sourceName} · pick where to send`
          : `${travelText(sides.travelMinutes)} by donkey · ${amountText(donkeys)} of ${amountText(sides.donkeysHave)} donkeys`}
      </p>
      <GoodsGrid
        goods={sides.goods}
        plans={plans}
        destinationIds={destinationIds}
        destinationNames={sides.destinationNames}
        onPlan={(resource, plan) => setEdited(new Map(plans).set(resource, plan))}
      />
      <button
        type="button"
        disabled={chosen === 0 || destinationIds.length === 0 || short || send.busy}
        title={short ? "Not enough donkeys for these loads" : undefined}
        onClick={() =>
          void send.run({ sourceId, destinationIds, sides, plans, interval: repeat ? interval : null }).then((sent) => {
            if (sent) setEdited(new Map());
          })
        }
        className="rounded-md bg-gold px-4 py-3 text-base font-semibold text-kit-ink disabled:opacity-50"
      >
        {sendWords(chosen, destinationIds.length, sides.travelMinutes, repeat, interval)}
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

/** The Send button's words: what leaves, to how many, and when it lands; or what is still missing. */
const sendWords = (goods: number, destinations: number, minutes: number, repeat: boolean, interval: number) => {
  if (destinations === 0) return "Choose where to send";
  if (goods === 0) return "Choose what to send";
  const to = destinations > 1 ? ` to ${destinations} holdings` : "";
  const every = repeat ? ` · every ${interval} min` : "";
  return `Send ${goods} ${goods === 1 ? "good" : "goods"}${to} · on the road ${travelText(minutes)}${every}`;
};

/** Each destination's goods, as the chain takes them: resource id then amount, at the resource precision. */
const shipments = (destinationIds: number[], destinationNames: string[], goods: Good[], plans: Plans) =>
  destinationIds.map((destinationId, index) => ({
    destinationId,
    destinationName: destinationNames[index],
    lines: goods
      .map((good) => ({ resource: good.resource, amount: sharesOf(plans.get(good.resource), destinationIds)[index] }))
      .filter((line) => line.amount > 0),
  }));

/**
 * Sends a transfer: one call per destination with its own goods, in one transaction. With an interval, each
 * destination also becomes a repeating transfer in Automation, sent once now as the old window did.
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
  }): Promise<boolean> => {
    const loads = shipments(destinationIds, sides.destinationNames, sides.goods, plans).filter(
      (load) => load.lines.length > 0,
    );
    if (loads.length === 0) return false;
    setBusy(true);
    try {
      await systemCalls.send_resources_multiple({
        signer: account,
        calls: loads.map((load) => ({
          sender_entity_id: BigInt(sourceId),
          recipient_entity_id: BigInt(load.destinationId),
          resources: load.lines.flatMap((line) => [line.resource, BigInt(line.amount) * BigInt(RESOURCE_PRECISION)]),
        })),
      });
      if (interval !== null) scheduleRepeats(addScheduled, sourceId, sides.sourceName, loads, interval);
      toast.success(loads.length > 1 ? "Transfers sent." : "Transfer sent.");
      return true;
    } catch (error) {
      toast.failed(error, "Transfer failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
};

/** Each destination's goods as a repeating transfer in Automation, already run once now. */
const scheduleRepeats = (
  addScheduled: ReturnType<typeof useTransferAutomationStore.getState>["add"],
  sourceId: number,
  sourceName: string,
  loads: ReturnType<typeof shipments>,
  interval: number,
) => {
  const now = Date.now();
  loads.forEach((load) =>
    addScheduled({
      sourceEntityId: String(sourceId),
      sourceName,
      destinationEntityId: String(load.destinationId),
      destinationName: load.destinationName,
      resourceIds: load.lines.map((line) => line.resource),
      resourceConfigs: load.lines.map((line) => ({ resourceId: line.resource, amount: line.amount })),
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
  onPlan,
}: {
  goods: Good[];
  plans: Plans;
  destinationIds: number[];
  destinationNames: string[];
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
  onPlan,
}: {
  good: Good;
  plan: GoodPlan | undefined;
  destinationIds: number[];
  destinationNames: string[];
  template: string;
  onPlan: (plan: GoodPlan) => void;
}) => {
  const shares = sharesOf(plan, destinationIds);
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
        value={plan?.total ?? 0}
        onChange={(event) => onPlan(withTotal(plan, Number(event.target.value), good.have))}
        className={cn(NUMBER_INPUT, "border-gold/30")}
      />
      <button type="button" onClick={() => onPlan(withTotal(plan, good.have, good.have))} className="text-sm text-gold">
        Max
      </button>
      {destinationIds.length > 1 &&
        destinationIds.map((id, index) => {
          const pinned = plan?.pinned.has(id) ?? false;
          return (
            <span key={id} className="relative">
              <input
                aria-label={`${name} to ${destinationNames[index]}`}
                type="number"
                min={0}
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
