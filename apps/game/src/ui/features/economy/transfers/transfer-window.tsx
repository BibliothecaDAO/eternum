import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import {
  HudButton,
  HudCheck,
  HudField,
  HudIconButton,
  HudPanel,
  HudTableHead,
  HudTableRow,
  HudTabs,
  HudTransfer,
  HudWindow,
} from "@/ui/design-system/kit/hud-elements";
import { iconDefinition, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { toast } from "@/ui/features/event-feed/notify";
import { ResourceArrivals } from "@/ui/features/economy/trading";
import { TransferAutomationAdvancedModal } from "@/ui/features/economy/transfers/transfer-automation-modal";
import { deliveryLandsAt, isMilitaryResource, ResourceManager, shipmentTravelSeconds } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds, formatCount, formatExact } from "@bibliothecadao/types";
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
 * goods; once everything landed, the next destinations chosen are prefilled again. A draft the player has changed since
 * is theirs: the outcome leaves it as it is (its notices still say what landed).
 */
const settled = (draft: Draft, sentRevision: number, refused: Shipment[], goods: Good[]): Draft =>
  draft.revision !== sentRevision
    ? draft
    : revised(draft, {
        ends: { ...draft.ends, destinationIds: refused.map((shipment) => shipment.destinationId) },
        edited: refused.length > 0 ? plansFor(refused, goods) : null,
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

type TransferView = "transfer" | "arrivals" | "automation" | "balances";

/**
 * The one transfer window: sending, and what is on its way, the repeating transfers and every holding's balances,
 * each a tab of it (Transfer · Arrivals · Automation · Balances). It opens on Transfer; a tab left keeps its draft, as
 * every panel stays drawn while hidden.
 */
const TransferSurface = ({ initial }: { initial: TransferEnds }) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const arrived = useUIStore((state) => state.arrivedArrivalsNumber);
  const pending = useUIStore((state) => state.pendingArrivalsNumber);
  const [view, setView] = useState<TransferView>("transfer");
  const panel = (key: TransferView) => ({ role: "tabpanel", "aria-label": key, hidden: view !== key });
  return (
    <HudWindow title="Transfer" icon="transfer" size="workspace" onClose={closeSurface}>
      <div className="flex flex-col gap-2 lg:h-full lg:min-h-0">
        <div aria-label="Transfer views">
          <HudTabs
            tabs={[
              { key: "transfer" as const, label: "Transfer" },
              {
                key: "arrivals" as const,
                label: "Arrivals",
                // Green once some is ready to claim, gold while all is on the road.
                count: arrived + pending > 0 ? arrived + pending : undefined,
                countTone: arrived > 0 ? ("good" as const) : undefined,
                title: `${arrived} ready · ${pending} pending`,
              },
              ...(showAutomation ? [{ key: "automation" as const, label: "Automation" }] : []),
              { key: "balances" as const, label: "Balances" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <div {...panel("transfer")} className="lg:min-h-0 lg:flex-1">
          <TransferWindow initial={initial} />
        </div>
        <div {...panel("arrivals")} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <ArrivalsView />
        </div>
        {showAutomation && (
          <div {...panel("automation")} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <TransferAutomationAdvancedModal />
          </div>
        )}
        <div {...panel("balances")} className="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <BalancesView />
        </div>
      </div>
    </HudWindow>
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
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:flex-row">
      {/* Each column is a HUD panel: the two ends at a fixed width, the goods taking the rest. */}
      <HudPanel
        collapsible={false}
        className="flex min-h-0 flex-col lg:w-64 lg:shrink-0"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
        <HoldingPicker
          title="Send from"
          chosen={ends.sourceId === null ? [] : [ends.sourceId]}
          otherEnd={ends.destinationIds}
          onPick={(id) => change({ ends: pickSource(ends, id), edited: null })}
          note={(id) => <DonkeysNote id={id} />}
        />
      </HudPanel>
      {/* Closed until one holding is chosen to send to, and it looks closed and says so. */}
      <span className="self-center max-lg:rotate-90">
        <HudIconButton
          icon="swap"
          label="Swap from and to"
          title={ends.destinationIds.length === 1 ? "Swap from and to" : "Choose one holding to send to, then swap"}
          disabled={ends.destinationIds.length !== 1}
          onClick={() => change({ ends: swapEnds(ends), edited: null })}
        />
      </span>
      <HudPanel
        collapsible={false}
        className="flex min-h-0 flex-col lg:w-64 lg:shrink-0"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
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
      </HudPanel>
      <HudPanel
        collapsible={false}
        className="flex min-h-0 min-w-0 flex-col lg:flex-1"
        bodyClassName="flex min-h-0 flex-1 flex-col gap-3"
      >
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
      </HudPanel>
    </div>
  );
};

/** A source row's note: the donkeys there, which carry everything it sends. */
const DonkeysNote = ({ id }: { id: number }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const donkeys = new ResourceManager(setup.store, id).balanceWithProduction(tick, ResourcesIds.Donkey)?.balance ?? 0;
  return <>{formatExact(Math.floor(Number(donkeys) / RESOURCE_PRECISION))} donkeys</>;
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
      <p className="text-hud-muted">
        {destinationIds.length === 0
          ? `${formatExact(sides.donkeysHave)} donkeys at ${sides.sourceName} · pick where to send`
          : `${landsText(landsIn)} · ${formatExact(donkeys)} of ${formatExact(sides.donkeysHave)} donkeys`}
      </p>
      <GoodsGrid
        goods={sides.goods}
        plans={plans}
        destinationIds={destinationIds}
        destinationNames={sides.destinationNames}
        focus={focus}
        onPlan={(resource, plan) => onPlans(new Map(plans).set(resource, plan))}
      />
      <HudButton
        kind="primary"
        disabled={chosen === 0 || destinationIds.length === 0 || short || send.busy}
        onClick={sendNow}
      >
        {sendWords({
          goods: chosen,
          destinations: destinationIds.length,
          landsIn,
          donkeys: { needed: donkeys, held: sides.donkeysHave },
          every: repeat ? interval : null,
        })}
      </HudButton>
      <span className="flex items-center gap-2 text-hud-muted">
        <HudCheck checked={repeat} label="Repeat" onChange={setRepeat} /> Repeat
        {repeat && (
          <>
            every
            <span className="w-16">
              <HudField
                aria-label="Minutes between runs"
                inputMode="numeric"
                value={String(interval)}
                onChange={(typed) => setInterval(Math.min(30, Math.max(1, Number(typed.replace(/\D/g, "")) || 1)))}
              />
            </span>
            min (Automation lists it)
          </>
        )}
      </span>
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
    return `Not enough donkeys: these loads need ${formatExact(donkeys.needed)}, ${formatExact(donkeys.held)} here`;
  const to = destinations > 1 ? ` to ${destinations} holdings` : "";
  const repeat = every === null ? "" : ` · every ${every} min`;
  return `Send ${formatCount(goods, "good")}${to} · ${landsText(landsIn)}${repeat}`;
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

/**
 * Every good the source holds, by the holding card's order: what it has, a slider, quick shares and the total to send
 * (HudTransfer); with several destinations each one's share under it, split evenly, a share typed by hand stays and ↺
 * returns it to the split.
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
  // The goods sit as the holding's card shows them; one the card never shows comes last, by id.
  const tiers = useGameModeConfig().resources.getTiers() as Record<string, ResourcesIds[]>;
  const rank = new Map(resourcesInTierOrder(tiers).map((resource, index) => [Number(resource), index]));
  const cardOrder = (good: Good) => rank.get(good.resource) ?? Number.MAX_SAFE_INTEGER;
  const sorted = goods.toSorted((a, b) => cardOrder(a) - cardOrder(b) || a.resource - b.resource);
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-auto">
      <HudTransfer
        rows={sorted.map((good) => ({
          icon: resourceMeaning(good.resource),
          name: resourceName(good.resource),
          held: good.have,
          value: sentTotal(plans.get(good.resource), good.have),
          focus: good.resource === focus,
        }))}
        onChange={(index, amount) => {
          const good = sorted[index];
          onPlan(good.resource, withTotal(plans.get(good.resource), amount, good.have));
        }}
      />
      {destinationIds.length > 1 && (
        <Shares
          goods={sorted}
          plans={plans}
          destinationIds={destinationIds}
          destinationNames={destinationNames}
          onPlan={onPlan}
        />
      )}
    </div>
  );
};

/** With several destinations, what each one gets of every good sent: split evenly until a share is typed by hand. */
const Shares = ({
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
  const cols = `minmax(7rem,1fr) repeat(${destinationIds.length}, 6rem)`;
  const sent = goods.filter((good) => sentTotal(plans.get(good.resource), good.have) > 0);
  if (sent.length === 0) return null;
  return (
    <div role="table" aria-label="Shares">
      <HudTableHead cols={cols}>
        <span role="columnheader">Share</span>
        {destinationNames.map((name, index) => (
          <span key={destinationIds[index]} role="columnheader" className="truncate text-right" title={name}>
            {name}
          </span>
        ))}
      </HudTableHead>
      {sent.map((good) => {
        const plan = plans.get(good.resource);
        const shares = sharesOf(plan, destinationIds, good.have);
        const honoured = honouredShares(plan, destinationIds, good.have);
        const name = resourceName(good.resource);
        return (
          <HudTableRow key={good.resource} cols={cols} label={`${name} shares`}>
            <span role="cell" className="flex items-center gap-2 truncate">
              <ResourceIcon resource={good.resource} size="sm" withTooltip={false} />
              {name}
            </span>
            {destinationIds.map((id, index) => (
              <span key={id} role="cell" className="flex items-center gap-1">
                <HudField
                  aria-label={`${name} to ${destinationNames[index]}`}
                  inputMode="numeric"
                  value={String(shares[index])}
                  onChange={(typed) =>
                    onPlan(
                      good.resource,
                      // A share typed with a fraction is kept as typed; the send takes whole units of it.
                      withShare(plan, id, Number(typed.replace(/[^\d.]/g, "")) || 0, good.have, destinationIds),
                    )
                  }
                />
                {honoured.has(id) && plan && (
                  <HudIconButton
                    icon="refresh"
                    label={`Split ${name} evenly again`}
                    title="Back to the even split"
                    kind="quiet"
                    size="sm"
                    onClick={() => onPlan(good.resource, withoutShare(plan, id))}
                  />
                )}
              </span>
            ))}
          </HudTableRow>
        );
      })}
    </div>
  );
};
