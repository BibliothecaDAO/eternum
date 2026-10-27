import { reloadBuildOrders, saveBuildOrders, useBuildOrderAccount, useBuildOrders } from "@/hooks/use-build-orders";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  AppButton,
  AppChip,
  AppField,
  AppIconButton,
  AppNotice,
  AppPanel,
  AppRow,
  AppTabs,
} from "@/ui/design-system/kit/app-elements";
import { BACK, BUILD_ORDER_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";
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
import { useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { Loading } from "../loading";
import { addStep, canAdd, moveStep, removeStep, setCount, stepsOfRank } from "./order-edits";
import { BUILD_ORDERS_PATH } from "./build-orders-route";

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

/**
 * What the page shows besides the list, held in its address so Back leaves an editor for the list: an order being
 * edited (`?edit=<id>`, or `new` with its draft in the navigation's state), an order being pasted (`?paste`), or
 * nothing.
 */
type View = { kind: "list" } | { kind: "edit"; id: string | null; draft: BuildOrder | undefined } | { kind: "paste" };

const useView = (): View => {
  const [params] = useSearchParams();
  const draft = (useLocation().state as { draft?: BuildOrder } | null)?.draft;
  const edit = params.get("edit");
  if (edit !== null) return { kind: "edit", id: edit === "new" ? null : edit, draft };
  return params.has("paste") ? { kind: "paste" } : { kind: "list" };
};

/** Opens a view: a draft travels in the navigation's state, the list is the page's own address. */
const useOpen = () => {
  const navigate = useNavigate();
  return {
    list: () => navigate(BUILD_ORDERS_PATH),
    edit: (id: string) => navigate(`${BUILD_ORDERS_PATH}?edit=${encodeURIComponent(id)}`),
    draft: (draft: BuildOrder) => navigate(`${BUILD_ORDERS_PATH}?edit=new`, { state: { draft } }),
    paste: () => navigate(`${BUILD_ORDERS_PATH}?paste`),
  };
};

/**
 * Build orders (the owner's pick, B: reached from Play's Blitz column): the orders saved on the player's account and the
 * one their games follow, an order made from step cards rank by rank, copied as JSON or pasted from it, and a prompt
 * for an AI to help write one. An order has no times: in a game, its next step shows once the realm can take it. The
 * desktop keeps the list at the left and the open order at the right; a phone shows one at a time.
 */
export const BuildOrdersPage = () => {
  useBuildOrderAccount();
  const view = useView();
  const desktop = useLayout() === "desktop";
  const open = view.kind === "list" ? <FollowedOrder /> : <OpenView view={view} />;
  if (desktop)
    return (
      <PageFrame back="/" title={BUILD_ORDER_WORDS.page}>
        <div className="grid grid-cols-[theme(width.rail)_minmax(0,1fr)] items-start gap-6">
          <div className="flex flex-col gap-4">
            <OrderList />
            <ListActions />
          </div>
          {open}
        </div>
      </PageFrame>
    );
  return view.kind === "list" ? (
    <PageFrame back="/" title={BUILD_ORDER_WORDS.page} foot={<ListActions />}>
      <OrderList />
    </PageFrame>
  ) : (
    open
  );
};

/**
 * An open order or paste: on a desktop, a panel beside the list ending on Back and its step; on a phone, the page
 * itself, its step in the page's foot and the page's Back to the list.
 */
const ViewFrame = ({
  title,
  icon,
  step,
  children,
}: {
  title: string;
  icon: IconMeaning;
  /** The view's one verb: Save, Read it. */
  step: ReactNode;
  children: ReactNode;
}) => {
  const open = useOpen();
  const phone = useLayout() === "phone";
  const panel = (
    <AppPanel title={title} icon={icon}>
      <div className="flex flex-col gap-4">
        {children}
        {!phone && (
          <div className="flex flex-wrap justify-end gap-2">
            <AppButton kind="secondary" icon="arrow-left" onClick={open.list}>
              {BACK}
            </AppButton>
            {step}
          </div>
        )}
      </div>
    </AppPanel>
  );
  return phone ? (
    <PageFrame back={BUILD_ORDERS_PATH} title={BUILD_ORDER_WORDS.page} foot={step}>
      {panel}
    </PageFrame>
  ) : (
    panel
  );
};

const OpenView = ({ view }: { view: Exclude<View, { kind: "list" }> }) => {
  if (view.kind === "paste") return <PasteOrder />;
  if (view.id === null) return <OrderEditor key="new" id={null} order={view.draft ?? newOrder()} />;
  return <SavedOrder key={view.id} id={view.id} />;
};

/**
 * A saved order opened to edit, from the account's orders once they are read. Once open, the draft is the editor's:
 * another device deleting the order meanwhile does not take it away, and Save adds it back.
 */
const SavedOrder = ({ id }: { id: string }) => {
  const { book, status } = useBuildOrders();
  const opened = useRef<BuildOrder | undefined>(undefined);
  opened.current ??= book?.orders.find((entry) => entry.id === id)?.order;
  if (opened.current) return <OrderEditor id={id} order={opened.current} />;
  return status === "loading" ? <Loading /> : <AppNotice tone="bad" line={BUILD_ORDER_WORDS.gone} />;
};

const newOrder = (): BuildOrder => ({ name: BUILD_ORDER_WORDS.newOrderName, steps: [] });

/** Paste an order and New order: shut once the account holds as many orders as it may. */
const ListActions = () => {
  const open = useOpen();
  const full = (useBuildOrders().book?.orders.length ?? 0) >= BUILD_ORDER_LIMITS.orders;
  return (
    <div className="flex flex-wrap gap-2">
      <AppButton kind="secondary" disabled={full} onClick={open.paste}>
        {BUILD_ORDER_WORDS.pasteOrder}
      </AppButton>
      <AppButton kind="primary" icon="plus" disabled={full} onClick={() => open.draft(newOrder())}>
        {BUILD_ORDER_WORDS.newOrder}
      </AppButton>
    </div>
  );
};

/**
 * The account's orders, the game's own last: Use makes one the order its games follow, the pencil opens it, and the
 * game's order is copied to edit. Signed out, only the game's order, which needs no saving.
 */
const OrderList = () => {
  const { status, book, notice } = useBuildOrders();
  const open = useOpen();
  const signedIn = status !== "signed-out";
  const orders = book?.orders ?? [];
  // Each press hands its save back, so the list holds until the account answers.
  const use = (active: string | null) => (book ? saveBuildOrders({ ...book, active }) : undefined);
  const full = orders.length >= BUILD_ORDER_LIMITS.orders;
  return (
    <div className="flex flex-col gap-3">
      {!signedIn && <AppNotice line={BUILD_ORDER_WORDS.signInToSave} />}
      {notice && <RequestNotice status={status} line={notice} retry={reloadBuildOrders} />}
      {full && <AppNotice line={BUILD_ORDER_WORDS.full(BUILD_ORDER_LIMITS.orders)} />}
      <AppPanel title={BUILD_ORDER_WORDS.yourOrders} icon="build" flush>
        {orders.map(({ id, order }) => (
          <OrderRow
            key={id}
            order={order}
            active={book?.active === id}
            onUse={() => use(id)}
            action={<AppIconButton icon="edit" label={BUILD_ORDER_WORDS.edit} onClick={() => open.edit(id)} />}
          />
        ))}
        <OrderRow
          order={{ ...DEFAULT_BUILD_ORDER, name: BUILD_ORDER_WORDS.theGamesOrder }}
          active={!book?.active}
          onUse={signedIn ? () => use(null) : undefined}
          action={
            <AppIconButton
              icon="copy"
              label={BUILD_ORDER_WORDS.copyToEdit}
              disabled={full}
              onClick={() => open.draft(DEFAULT_BUILD_ORDER)}
            />
          }
        />
      </AppPanel>
    </div>
  );
};

const OrderRow = ({
  order,
  active,
  onUse,
  action,
}: {
  order: BuildOrder;
  active: boolean;
  onUse?: () => unknown;
  action: ReactNode;
}) => (
  <AppRow
    own={active}
    lead={<Icon name={active ? "star" : "book"} size={28} />}
    title={order.name}
    detail={BUILD_ORDER_WORDS.steps(order.steps.length)}
    trail={
      // One group, so the row keeps its words on one line beside it on a phone.
      <span className="flex items-center gap-2">
        {active ? (
          <AppChip tone="good">{BUILD_ORDER_WORDS.active}</AppChip>
        ) : (
          onUse && (
            <AppButton kind="secondary" onClick={onUse}>
              {BUILD_ORDER_WORDS.use}
            </AppButton>
          )
        )}
        {action}
      </span>
    }
  />
);

/** The desktop's right while nothing is open: the order the player's games follow, rank by rank, and the way to edit it. */
const FollowedOrder = () => {
  const { book } = useBuildOrders();
  const open = useOpen();
  const id = book?.active ?? null;
  const order = book?.orders.find((entry) => entry.id === id)?.order ?? DEFAULT_BUILD_ORDER;
  return (
    <AppPanel
      title={id ? order.name : BUILD_ORDER_WORDS.theGamesOrder}
      icon="star"
      cue={
        id ? (
          <AppButton kind="secondary" icon="edit" onClick={() => open.edit(id)}>
            {BUILD_ORDER_WORDS.edit}
          </AppButton>
        ) : (
          <AppButton kind="secondary" icon="copy" onClick={() => open.draft(DEFAULT_BUILD_ORDER)}>
            {BUILD_ORDER_WORDS.copyToEdit}
          </AppButton>
        )
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {REALM_LEVELS.map((rank, key) => (
          <section key={rank} className="flex flex-col gap-2" aria-label={rank}>
            <h3 className="text-app-label text-app-muted">{rank}</h3>
            {stepsOfRank(order, key).map(({ step, index }) => (
              <span key={index} className="flex items-center gap-2 text-app-body text-app-ink">
                <Icon name={GOAL_ICONS[step.goal]} size={32} />
                {BUILD_ORDER_WORDS.goals[step.goal]}
                {step.goal !== "levelUp" && <b className="text-app-gold">{step.count}</b>}
              </span>
            ))}
          </section>
        ))}
      </div>
    </AppPanel>
  );
};

/**
 * An order made from step cards: its name, a tab for each rank with its steps in order, each with its count, its place
 * and its removal, then the goals to add to the open rank. Saving keeps it on the account; a new order becomes the one
 * the player's games follow.
 */
const OrderEditor = ({ id: savedId, order: start }: { id: string | null; order: BuildOrder }) => {
  const { status, book, notice } = useBuildOrders();
  const open = useOpen();
  // One id for the draft's life: a save retried after its answer was lost replaces the order instead of adding it twice.
  const [id] = useState(() => savedId ?? crypto.randomUUID());
  const [order, setOrder] = useState(start);
  const [rank, setRank] = useState(order.steps[0]?.rank ?? 0);
  const [note, setNote] = useState<string | null>(null);
  const read = readBuildOrderText(buildOrderJson(order));
  const problem = "error" in read ? read.error : null;
  /**
   * The draft written into the book the account holds now (read again after another device saved): in its place, or
   * added, and followed, when the book has no such order.
   */
  const save = async () => {
    if (!book || problem) return;
    const held = book.orders.some((entry) => entry.id === id);
    const saved: BuildOrderBook = held
      ? { ...book, orders: book.orders.map((entry) => (entry.id === id ? { id, order } : entry)) }
      : { orders: [...book.orders, { id, order }], active: id };
    if (await saveBuildOrders(saved)) open.list();
  };
  const remove = async () => {
    if (!book) return;
    const kept = {
      orders: book.orders.filter((entry) => entry.id !== id),
      active: book.active === id ? null : book.active,
    };
    if (await saveBuildOrders(kept)) open.list();
  };
  const busy = status === "loading" || status === "saving";
  const held = book?.orders.some((entry) => entry.id === id) ?? false;
  const copy = async (text: string, done: string) =>
    setNote((await copied(text)) ? done : BUILD_ORDER_WORDS.noClipboard);
  return (
    <ViewFrame
      title={order.name || BUILD_ORDER_WORDS.newOrderName}
      icon="build"
      step={
        <AppButton kind="primary" disabled={problem !== null || !book || busy} onClick={save}>
          {BUILD_ORDER_WORDS.save}
        </AppButton>
      }
    >
      <AppField
        label={BUILD_ORDER_WORDS.name}
        value={order.name}
        maxLength={BUILD_ORDER_LIMITS.name}
        onChange={(event) => setOrder({ ...order, name: event.target.value })}
      />
      <AppTabs
        label={BUILD_ORDER_WORDS.ranks}
        tabs={REALM_LEVELS.map((label, key) => ({
          key: String(key),
          label: `${label} ${stepsOfRank(order, key).length}`,
        }))}
        value={String(rank)}
        onChange={(key) => setRank(Number(key))}
      >
        <div className="flex flex-col">
          {stepsOfRank(order, rank).map(({ step, index }) => (
            <StepCard
              key={index}
              goal={step.goal}
              count={step.goal === "levelUp" ? null : step.count}
              onCount={(count) => setOrder(setCount(order, index, count))}
              onEarlier={() => setOrder(moveStep(order, index, -1))}
              onLater={() => setOrder(moveStep(order, index, 1))}
              onRemove={() => setOrder(removeStep(order, index))}
            />
          ))}
        </div>
      </AppTabs>
      <section className="flex flex-col gap-2" aria-label={BUILD_ORDER_WORDS.addTo(REALM_LEVELS[rank])}>
        <h3 className="text-app-label text-app-muted">{BUILD_ORDER_WORDS.addTo(REALM_LEVELS[rank])}</h3>
        <div className="flex flex-wrap gap-2">
          {BUILD_ORDER_GOALS.map((goal) => (
            <AppButton
              key={goal}
              kind="secondary"
              icon={GOAL_ICONS[goal]}
              disabled={!canAdd(order, rank, goal)}
              onClick={() => setOrder(addStep(order, rank, goal))}
            >
              {BUILD_ORDER_WORDS.goals[goal]}
            </AppButton>
          ))}
        </div>
      </section>
      {problem && <AppNotice tone="warn" line={problem} />}
      <div className="flex flex-wrap gap-2">
        <AppButton
          kind="quiet"
          icon="copy"
          disabled={problem !== null}
          onClick={() => copy(buildOrderJson(order), BUILD_ORDER_WORDS.copied)}
        >
          {BUILD_ORDER_WORDS.copyJson}
        </AppButton>
        <AppButton
          kind="quiet"
          icon="share"
          onClick={() => copy(buildOrderPrompt(order), BUILD_ORDER_WORDS.promptCopied)}
        >
          {BUILD_ORDER_WORDS.askAi}
        </AppButton>
        {held && (
          <AppButton kind="quiet" tone="bad" icon="trash" disabled={busy} onClick={remove}>
            {BUILD_ORDER_WORDS.remove}
          </AppButton>
        )}
      </div>
      {note && <AppNotice line={note} />}
      {status === "signed-out" && <AppNotice line={BUILD_ORDER_WORDS.signInToSave} />}
      {notice && <RequestNotice status={status} line={notice} retry={book ? save : reloadBuildOrders} />}
    </ViewFrame>
  );
};

/** One step: its building's painting and name, how many (a level up has no count), and its place in the rank. */
const StepCard = ({
  goal,
  count,
  onCount,
  onEarlier,
  onLater,
  onRemove,
}: {
  goal: BuildOrderGoal;
  count: number | null;
  onCount: (count: number) => void;
  onEarlier: () => void;
  onLater: () => void;
  onRemove: () => void;
}) => {
  const name = BUILD_ORDER_WORDS.goals[goal];
  return (
    <AppRow
      lead={<Icon name={GOAL_ICONS[goal]} size={32} />}
      title={name}
      trail={
        <span className="flex items-center gap-2">
          {count !== null && (
            <>
              <AppIconButton
                icon="minus"
                kind="secondary"
                label={BUILD_ORDER_WORDS.fewer(name)}
                disabled={count <= 1}
                onClick={() => onCount(count - 1)}
              />
              <b className="min-w-6 text-center text-app-gold">{count}</b>
              <AppIconButton
                icon="plus"
                kind="secondary"
                label={BUILD_ORDER_WORDS.more(name)}
                disabled={count >= BUILD_ORDER_LIMITS.count}
                onClick={() => onCount(count + 1)}
              />
            </>
          )}
          <AppIconButton icon="arrow-up" label={BUILD_ORDER_WORDS.earlier} onClick={onEarlier} />
          <AppIconButton icon="arrow-down" label={BUILD_ORDER_WORDS.later} onClick={onLater} />
          <AppIconButton icon="trash" tone="bad" label={BUILD_ORDER_WORDS.removeStep(name)} onClick={onRemove} />
        </span>
      }
    />
  );
};

/** An order pasted as JSON, read by the language's own reader; once it reads, it opens as a new order to save. */
const PasteOrder = () => {
  const open = useOpen();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const readIt = () => {
    const read = readBuildOrderText(text);
    if ("error" in read) setError(read.error);
    else open.draft(read.ok);
  };
  return (
    <ViewFrame
      title={BUILD_ORDER_WORDS.pasteOrder}
      icon="copy"
      step={
        <AppButton kind="primary" disabled={text.trim() === ""} onClick={readIt}>
          {BUILD_ORDER_WORDS.readIt}
        </AppButton>
      }
    >
      <AppField
        label={BUILD_ORDER_WORDS.pasteHere}
        value={text}
        error={error ?? undefined}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
      />
    </ViewFrame>
  );
};

/**
 * What the account's last read or save left to say: a failure, with its way to try again; or that the orders were read
 * again after another device saved, where Save is the way on.
 */
const RequestNotice = ({ status, line, retry }: { status: string; line: string; retry: () => unknown }) =>
  status === "error" ? (
    <AppNotice
      tone="bad"
      line={line}
      actions={
        <AppButton kind="secondary" onClick={() => void retry()}>
          {TRY_AGAIN}
        </AppButton>
      }
    />
  ) : (
    <AppNotice tone="warn" line={line} />
  );

/** Writes to the clipboard; false where the page may not. */
const copied = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
