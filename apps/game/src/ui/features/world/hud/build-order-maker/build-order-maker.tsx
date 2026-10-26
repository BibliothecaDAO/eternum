import { saveBuildOrders, useBuildOrders } from "@/hooks/use-build-orders";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudField,
  HudIconButton,
  HudNotice,
  HudNumberField,
  HudRow,
  HudTabs,
  HudWindow,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { BACK, BUILD_ORDER_WORDS } from "@/ui/design-system/kit/words";
import {
  BUILD_ORDER_GOALS,
  BUILD_ORDER_LIMITS,
  buildOrderJson,
  buildOrderPrompt,
  DEFAULT_BUILD_ORDER,
  readBuildOrderText,
  type BuildOrder,
  type BuildOrderBook,
  type BuildOrderGoal,
} from "@bibliothecadao/eternum/automation";
import { REALM_LEVELS } from "@bibliothecadao/types";
import { useState, type ReactNode } from "react";

import { addStep, canAdd, moveStep, removeStep, setCount, stepsOfRank } from "./order-edits";

/** The maker's window id: one window, opened from the Build order panel. */
const BUILD_ORDER_MAKER_SURFACE_ID = "build-order-maker";

export const openBuildOrderMaker = () =>
  usePopoverStore.getState().openSurface({ id: BUILD_ORDER_MAKER_SURFACE_ID, content: <BuildOrderMaker /> });

/** Each goal's painting, as its card and the palette show it. */
const GOAL_ICONS: Record<BuildOrderGoal, IconMeaning> = {
  farm: "farm",
  wood: "wood",
  coal: "coal",
  copper: "copper",
  hut: "workers-hut",
  barracks: "barracks",
  army: "deploy",
  levelUp: "upgrade",
};

/** What the window shows: the player's orders, one being made (a new one has no id yet), or one being pasted in. */
type View = { kind: "list" } | { kind: "edit"; id: string | null; order: BuildOrder } | { kind: "paste" };

/**
 * The build order maker: the orders saved on the player's account and the one their Build order panel follows; an
 * order made from step cards, rank by rank; copied as JSON or pasted from it; and a prompt for an AI to help write
 * one. An order has no times: in a game, its next step shows once the realm can take it.
 */
export const BuildOrderMaker = () => {
  const [view, setView] = useState<View>({ kind: "list" });
  const close = () => usePopoverStore.getState().closeSurface();
  return (
    <HudWindow title={BUILD_ORDER_WORDS.yourOrders} icon="build" size="task" onClose={close}>
      {view.kind === "list" && <OrderList onView={setView} />}
      {view.kind === "edit" && <OrderEditor view={view} onView={setView} />}
      {view.kind === "paste" && <PasteOrder onView={setView} />}
    </HudWindow>
  );
};

/** The account's orders, the game's own last; Use makes one the panel's, and the default needs no saving. */
const OrderList = ({ onView }: { onView: (view: View) => void }) => {
  const { status, book, error } = useBuildOrders();
  const signedIn = status !== "signed-out";
  const orders = book?.orders ?? [];
  // Each press hands its save back, so its button holds until the account answers.
  const use = (active: string | null) => (book ? saveBuildOrders({ ...book, active }) : undefined);
  const remove = (id: string) =>
    book
      ? saveBuildOrders({
          orders: book.orders.filter((entry) => entry.id !== id),
          active: book.active === id ? null : book.active,
        })
      : undefined;
  const full = orders.length >= BUILD_ORDER_LIMITS.orders;
  return (
    <div className="flex flex-col gap-2">
      {!signedIn && <HudNotice line={BUILD_ORDER_WORDS.signInToSave} />}
      {error && <HudNotice tone="bad" line={error} />}
      {orders.map(({ id, order }) => (
        <OrderRow
          key={id}
          order={order}
          active={book?.active === id}
          onUse={() => use(id)}
          actions={
            <>
              <HudIconButton
                icon="edit"
                label={BUILD_ORDER_WORDS.edit}
                kind="quiet"
                size="sm"
                onClick={() => onView({ kind: "edit", id, order })}
              />
              <HudIconButton
                icon="trash"
                label={BUILD_ORDER_WORDS.remove}
                kind="quiet"
                size="sm"
                onClick={() => remove(id)}
              />
            </>
          }
        />
      ))}
      <OrderRow
        order={{ ...DEFAULT_BUILD_ORDER, name: BUILD_ORDER_WORDS.theGamesOrder }}
        active={!book?.active}
        onUse={signedIn ? () => use(null) : undefined}
        actions={
          <HudIconButton
            icon="copy"
            label={BUILD_ORDER_WORDS.copyToEdit}
            kind="quiet"
            size="sm"
            disabled={full}
            onClick={() => onView({ kind: "edit", id: null, order: DEFAULT_BUILD_ORDER })}
          />
        }
      />
      {full && <HudNotice line={BUILD_ORDER_WORDS.full(BUILD_ORDER_LIMITS.orders)} />}
      <HudWindowFoot>
        <HudButton kind="secondary" disabled={full} onClick={() => onView({ kind: "paste" })}>
          {BUILD_ORDER_WORDS.pasteOrder}
        </HudButton>
        <HudButton
          kind="primary"
          icon="plus"
          disabled={full}
          onClick={() => onView({ kind: "edit", id: null, order: { name: BUILD_ORDER_WORDS.newOrderName, steps: [] } })}
        >
          {BUILD_ORDER_WORDS.newOrder}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

const OrderRow = ({
  order,
  active,
  onUse,
  actions,
}: {
  order: BuildOrder;
  active: boolean;
  onUse?: () => unknown;
  actions: ReactNode;
}) => (
  <HudRow
    lead={<Icon name={active ? "star" : "book"} size={24} />}
    title={order.name}
    detail={BUILD_ORDER_WORDS.steps(order.steps.length)}
    selected={active}
    trail={
      <>
        {active ? (
          <HudChip tone="good">{BUILD_ORDER_WORDS.active}</HudChip>
        ) : (
          onUse && (
            <HudButton kind="secondary" size="sm" onClick={onUse}>
              {BUILD_ORDER_WORDS.use}
            </HudButton>
          )
        )}
        {actions}
      </>
    }
  />
);

/**
 * An order made from step cards: its name, a tab for each rank with its steps in order, each with its count, its place
 * and its removal, then the goals to add to the open rank. Saving keeps it on the account; a new order becomes the one
 * the panel follows.
 */
const OrderEditor = ({ view, onView }: { view: Extract<View, { kind: "edit" }>; onView: (view: View) => void }) => {
  const { status, book } = useBuildOrders();
  const [order, setOrder] = useState(view.order);
  const [rank, setRank] = useState(order.steps[0]?.rank ?? 0);
  const [note, setNote] = useState<string | null>(null);
  const read = readBuildOrderText(buildOrderJson(order));
  const problem = "error" in read ? read.error : null;
  const save = async () => {
    if (!book || problem) return;
    const id = view.id ?? crypto.randomUUID();
    const orders = view.id
      ? book.orders.map((entry) => (entry.id === id ? { id, order } : entry))
      : [...book.orders, { id, order }];
    const saved: BuildOrderBook = { orders, active: view.id ? book.active : id };
    if (await saveBuildOrders(saved)) onView({ kind: "list" });
  };
  const copy = async (text: string, done: string) =>
    setNote((await copied(text)) ? done : BUILD_ORDER_WORDS.noClipboard);
  return (
    <div className="flex flex-col gap-2">
      <HudField
        aria-label={BUILD_ORDER_WORDS.name}
        value={order.name}
        maxLength={BUILD_ORDER_LIMITS.name}
        onChange={(name) => setOrder({ ...order, name })}
      />
      <HudTabs
        tabs={REALM_LEVELS.map((label, key) => ({ key, label, count: stepsOfRank(order, key).length }))}
        value={rank}
        onChange={setRank}
        size="sm"
      />
      {stepsOfRank(order, rank).map(({ step, index }) => (
        <HudRow
          key={index}
          lead={<Icon name={GOAL_ICONS[step.goal]} size={28} />}
          title={BUILD_ORDER_WORDS.goals[step.goal]}
          trail={
            <>
              {step.goal !== "levelUp" && (
                <span className="w-28">
                  <HudNumberField
                    label={BUILD_ORDER_WORDS.count(BUILD_ORDER_WORDS.goals[step.goal])}
                    value={step.count}
                    min={1}
                    max={BUILD_ORDER_LIMITS.count}
                    onChange={(count) => setOrder(setCount(order, index, count))}
                  />
                </span>
              )}
              <HudIconButton
                icon="arrow-up"
                label={BUILD_ORDER_WORDS.earlier}
                kind="quiet"
                size="sm"
                onClick={() => setOrder(moveStep(order, index, -1))}
              />
              <HudIconButton
                icon="arrow-down"
                label={BUILD_ORDER_WORDS.later}
                kind="quiet"
                size="sm"
                onClick={() => setOrder(moveStep(order, index, 1))}
              />
              <HudIconButton
                icon="trash"
                label={BUILD_ORDER_WORDS.remove}
                kind="quiet"
                size="sm"
                onClick={() => setOrder(removeStep(order, index))}
              />
            </>
          }
        />
      ))}
      <p className="text-hud-label text-hud-muted">{BUILD_ORDER_WORDS.addTo(REALM_LEVELS[rank])}</p>
      <div className="flex flex-wrap gap-1.5">
        {BUILD_ORDER_GOALS.map((goal) => (
          <HudButton
            key={goal}
            kind="secondary"
            size="sm"
            icon={GOAL_ICONS[goal]}
            disabled={!canAdd(order, rank, goal)}
            onClick={() => setOrder(addStep(order, rank, goal))}
          >
            {BUILD_ORDER_WORDS.goals[goal]}
          </HudButton>
        ))}
      </div>
      {problem && <HudNotice tone="warn" line={problem} />}
      <div className="flex flex-wrap gap-1.5">
        <HudButton
          kind="secondary"
          size="sm"
          icon="copy"
          disabled={problem !== null}
          onClick={() => copy(buildOrderJson(order), BUILD_ORDER_WORDS.copied)}
        >
          {BUILD_ORDER_WORDS.copyJson}
        </HudButton>
        <HudButton
          kind="secondary"
          size="sm"
          icon="share"
          onClick={() => copy(buildOrderPrompt(order), BUILD_ORDER_WORDS.promptCopied)}
        >
          {BUILD_ORDER_WORDS.askAi}
        </HudButton>
      </div>
      {note && <HudNotice line={note} />}
      {status === "signed-out" && <HudNotice line={BUILD_ORDER_WORDS.signInToSave} />}
      <HudWindowFoot>
        <HudButton kind="secondary" icon="arrow-left" onClick={() => onView({ kind: "list" })}>
          {BACK}
        </HudButton>
        <HudButton kind="primary" disabled={problem !== null || !book} onClick={save}>
          {BUILD_ORDER_WORDS.save}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

/** An order pasted as JSON, read by the language's own reader; once it reads, it opens as a new order to save. */
const PasteOrder = ({ onView }: { onView: (view: View) => void }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const readIt = () => {
    const read = readBuildOrderText(text);
    if ("error" in read) setError(read.error);
    else onView({ kind: "edit", id: null, order: read.ok });
  };
  return (
    <div className="flex flex-col gap-2">
      <HudField
        aria-label={BUILD_ORDER_WORDS.pasteHere}
        placeholder={BUILD_ORDER_WORDS.pasteHere}
        value={text}
        onChange={(typed) => {
          setText(typed);
          setError(null);
        }}
      />
      {error && <HudNotice tone="bad" line={error} />}
      <HudWindowFoot>
        <HudButton kind="secondary" icon="arrow-left" onClick={() => onView({ kind: "list" })}>
          {BACK}
        </HudButton>
        <HudButton kind="primary" disabled={text.trim() === ""} onClick={readIt}>
          {BUILD_ORDER_WORDS.readIt}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

/** Writes to the clipboard; false where the page may not. */
const copied = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
