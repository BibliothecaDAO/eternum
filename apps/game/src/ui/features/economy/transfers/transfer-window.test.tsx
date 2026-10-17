import { EternumProvider, TransactionNotSentError } from "@bibliothecadao/provider";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { act, type ReactNode, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The window as a player uses it, down to the provider's own `send_resources_multiple`: only the shard's answers are
 * stood in for. Each test says which destinations the game applies, refuses, or never answers for.
 */
const world = vi.hoisted(() => ({
  surface: null as ReactNode,
  /** Destination → how the shard answers its shipment. */
  answers: new Map<bigint, "applied" | "rejected" | "not-sent" | "unknown">(),
  /** Every shipment the game applied, in order: destination and its resources. */
  applied: [] as Array<{ to: bigint; resources: Array<{ resource_type: number; amount: bigint }> }>,
  scheduled: vi.fn(),
  notices: { success: vi.fn(), warning: vi.fn(), failed: vi.fn() },
  sides: { wheat: 100, donkeys: 10, listeners: new Set<() => void>() },
  /** While set, the game's answers wait for it: a shipment the player can act around before its outcome. */
  hold: null as Promise<void> | null,
}));

const A = 22;
const B = 33;
const NAMES = new Map([
  [A, "Alpha"],
  [B, "Beta"],
]);

/** The shard: a submission per command, answered as the test set it up. */
const shard = {
  submitCommand: async (_signer: unknown, command: { value: { to_entity_id: bigint; resources: unknown } }) => {
    const to = BigInt(command.value.to_entity_id);
    const answer = world.answers.get(to) ?? "applied";
    if (answer === "not-sent") throw new TransactionNotSentError(`0x${to}`);
    if (answer === "applied") world.applied.push({ to, resources: command.value.resources as never });
    return { transaction_hash: `0x${to.toString(16)}` };
  },
};

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      systemCalls: {
        send_resources_multiple: (props: never) => EternumProvider.prototype.send_resources_multiple.call(shard, props),
      },
    },
    account: { account: { address: "0x1" } },
  }),
}));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({
    waitForAction: async (hash: string) => {
      if (world.hold) await world.hold;
      const answer = world.answers.get(BigInt(hash)) ?? "applied";
      if (answer === "unknown") throw new Error("No answer from the shard yet; the action may still apply.");
      return { hash, block: 1, status: answer === "rejected" ? "REJECTED" : "SUCCEEDED", revertReason: "No room" };
    },
  }),
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: Object.assign(
    (select: (state: object) => unknown) => select({ arrivedArrivalsNumber: 0, pendingArrivalsNumber: 0 }),
    { getState: () => ({ setLeftNavigationView: () => {} }) },
  ),
}));
vi.mock("@/hooks/store/use-popover-store", () => ({
  usePopoverStore: Object.assign((select: (state: object) => unknown) => select({ closeSurface: () => {} }), {
    getState: () => ({ openSurface: (surface: { content: ReactNode }) => (world.surface = surface.content) }),
  }),
}));
vi.mock("@/hooks/store/use-transfer-automation-store", () => ({
  useTransferAutomationStore: (select: (state: object) => unknown) => select({ add: world.scheduled }),
}));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  SURFACE_WORKSPACE_CLASS: "",
  SurfaceFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: world.notices }));
vi.mock("@bibliothecadao/eternum", () => ({
  computeTravelTime: () => 0,
  configManager: { getSpeedConfig: () => 1 },
  ResourceManager: class {
    balanceWithProduction() {
      return { balance: 0 };
    }
  },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0 }));
/** Each end as a row of buttons, as the real picker offers them: never the other end. */
vi.mock("./holding-picker", () => ({
  HoldingPicker: ({ title, otherEnd, onPick }: { title: string; otherEnd: number[]; onPick: (id: number) => void }) => (
    <section aria-label={title}>
      {[A, B]
        .filter((id) => !otherEnd.includes(id))
        .map((id) => (
          <button key={id} type="button" data-pick={`${title}:${id}`} onClick={() => onPick(id)} />
        ))}
    </section>
  ),
}));
/** The source holds wheat (1 kg a unit) and donkeys that carry 50 kg each; the test can change what it holds. */
vi.mock("./use-transfer-sides", () => ({
  useTransferSides: (_source: number, destinationIds: number[]) => {
    const held = useSyncExternalStore(
      (listener) => {
        world.sides.listeners.add(listener);
        return () => world.sides.listeners.delete(listener);
      },
      () => `${world.sides.wheat}:${world.sides.donkeys}`,
    );
    const [wheat, donkeys] = held.split(":").map(Number);
    return {
      sourceName: "Home",
      destinationNames: destinationIds.map((id) => NAMES.get(id) ?? String(id)),
      sourceRole: "realm",
      destinationRoles: destinationIds.map(() => "realm"),
      goods: [
        { resource: ResourcesIds.Wheat, have: wheat, weightKg: 1 },
        { resource: ResourcesIds.Donkey, have: donkeys, weightKg: 0 },
      ],
      travelMinutes: 1,
      donkeysHave: donkeys,
      donkeyCapacityKg: 50,
    };
  },
}));

import { iconDefinition, resourceMeaning } from "@/ui/design-system/icon-meaning";
import { openTransfer } from "./transfer-window";

const DONKEYS = iconDefinition(resourceMeaning(ResourcesIds.Donkey)).label;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  world.answers.clear();
  world.applied.length = 0;
  world.scheduled.mockClear();
  Object.values(world.notices).forEach((notice) => notice.mockClear());
  world.sides.wheat = 100;
  world.sides.donkeys = 10;
  world.hold = null;
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

const open = async (destinationIds = [A, B]) => {
  openTransfer({ sourceId: 11, destinationIds });
  await act(async () => root.render(world.surface));
};
const field = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const type = async (label: string, value: string) => {
  const input = field(label)!;
  await act(async () => {
    input.value = value;
    Simulate.change(input);
  });
};
const sendButton = () =>
  [...host.querySelectorAll("button")].find((button) => /^(Send|Choose|Not enough)/.test(button.textContent!))!;
const send = async () => act(async () => sendButton().click());
/** Anything the window writes in red. */
const redText = () =>
  [...host.querySelectorAll('[class*="red-"], [class*="danger"]')].map((element) => element.textContent);
const toggle = async (id: number) =>
  act(async () => host.querySelector<HTMLButtonElement>(`[data-pick="Send to:${id}"]`)!.click());
const setHeld = async (wheat: number) =>
  act(async () => {
    world.sides.wheat = wheat;
    world.sides.listeners.forEach((listener) => listener());
  });
/** The wheat each applied shipment carried, in whole units. */
const wheatSent = () =>
  world.applied.map(({ to, resources }) => [
    Number(to),
    Number(resources.find((line) => line.resource_type === ResourcesIds.Wheat)!.amount / BigInt(RESOURCE_PRECISION)),
  ]);

describe("the transfer window's amounts", () => {
  it("never sends more than the total shown: lowering it below a hand-set share splits it evenly again", async () => {
    await open();
    await type("Wheat: total to send", "100");
    await type("Wheat to Alpha", "80");
    await type("Wheat: total to send", "10");
    expect(field("Wheat: total to send")!.value).toBe("10");
    await send();
    expect(wheatSent()).toEqual([
      [A, 5],
      [B, 5],
    ]);
  });

  it("sends a hand-set fraction as whole units instead of failing", async () => {
    await open();
    await type("Wheat: total to send", "10");
    await type("Wheat to Alpha", "1.5");
    await send();
    expect(world.notices.failed).not.toHaveBeenCalled();
    // A landed send is told once, by its own row in Events (then its story), never also by a notice.
    expect(world.notices.success).not.toHaveBeenCalled();
    expect(wheatSent()).toEqual([
      [A, 1],
      [B, 9],
    ]);
  });

  it("drops a hand-set share when its destination's partner goes, and restores it when it returns", async () => {
    await open();
    await type("Wheat: total to send", "100");
    await type("Wheat to Alpha", "80");
    await toggle(B);
    expect(field("Wheat to Alpha")).toBeNull();
    expect(field("Wheat: total to send")!.value).toBe("100");
    await toggle(B);
    expect(field("Wheat to Alpha")!.value).toBe("80");
    expect(field("Wheat to Beta")!.value).toBe("20");
  });

  it("shows and sends no more than the source holds when its balance falls", async () => {
    await open();
    await type("Wheat: total to send", "100");
    await type("Wheat to Alpha", "80");
    await setHeld(50);
    expect(field("Wheat: total to send")!.value).toBe("50");
    await send();
    expect(wheatSent()).toEqual([
      [A, 25],
      [B, 25],
    ]);
  });

  it("keeps Send closed when the donkeys sent and those that carry pass the donkeys held", async () => {
    await open([A]);
    await type("Wheat: total to send", "100");
    await type(`${DONKEYS}: total to send`, "8");
    // 100 kg needs 2 carriers beside the 8 sent: 10 of 10.
    expect(sendButton().disabled).toBe(false);
    await type(`${DONKEYS}: total to send`, "9");
    expect(sendButton().disabled).toBe(true);
    expect(sendButton().textContent).toBe("Not enough donkeys: these loads need 11, 10 here");
    expect(redText()).toEqual([]);
  });

  it("opens without an error: the closed Send says what to choose", async () => {
    await open([]);
    expect(redText()).toEqual([]);
    expect(sendButton().textContent).toBe("Choose where to send");
    await toggle(A);
    expect(sendButton().textContent).toBe("Choose what to send");
    expect(sendButton().disabled).toBe(true);
  });
});

describe("the transfer window's send", () => {
  it("sends the refused destination again, and only it", async () => {
    world.answers.set(BigInt(B), "rejected");
    await open();
    await type("Wheat: total to send", "10");
    await send();
    expect(wheatSent()).toEqual([[A, 5]]);
    expect(world.notices.failed).toHaveBeenCalledWith(expect.any(Error), expect.any(String), {
      description: "Nothing reached Beta.",
    });
    // Beta stays chosen alone, with its own 5; Alpha has left the window.
    expect(field("Wheat to Alpha")).toBeNull();
    expect(sendButton().textContent).toMatch(/^Send 1 good · /);
    expect(field("Wheat: total to send")!.value).toBe("5");

    world.answers.set(BigInt(B), "applied");
    await send();
    expect(wheatSent()).toEqual([
      [A, 5],
      [B, 5],
    ]);
  });

  it("treats a send the shard refused as unsent, and sends it again", async () => {
    world.answers.set(BigInt(B), "not-sent");
    await open();
    await type("Wheat: total to send", "10");
    await send();
    world.answers.set(BigInt(B), "applied");
    await send();
    expect(wheatSent()).toEqual([
      [A, 5],
      [B, 5],
    ]);
  });

  it("never sends again by itself a shipment whose outcome is unknown", async () => {
    world.answers.set(BigInt(B), "unknown");
    await open();
    await type("Wheat: total to send", "10");
    await send();
    expect(world.notices.warning).toHaveBeenCalledWith(expect.stringContaining("No answer for Beta"));
    expect(sendButton().textContent).toBe("Choose where to send");
  });

  it("files only the shipments that landed under Automation when Repeat is on", async () => {
    world.answers.set(BigInt(B), "rejected");
    await open();
    await type("Wheat: total to send", "10");
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await send();
    expect(world.scheduled).toHaveBeenCalledTimes(1);
    expect(world.scheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationEntityId: String(A),
        resourceConfigs: [{ resourceId: ResourcesIds.Wheat, amount: 5 }],
      }),
    );
  });
});

describe("a shipment's outcome and the draft shown meanwhile", () => {
  /** Holds every answer until the returned release is called. */
  const holdAnswers = () => {
    let release!: () => void;
    world.hold = new Promise<void>((resolve) => (release = resolve));
    return async () => act(async () => release());
  };
  const pickSource = async (id: number) =>
    act(async () => host.querySelector<HTMLButtonElement>(`[data-pick="Send from:${id}"]`)!.click());

  it("leaves a newly chosen source and its amounts as the player set them", async () => {
    const release = holdAnswers();
    await open([A]);
    await type("Wheat: total to send", "10");
    await send();
    expect(sendButton().disabled).toBe(true);
    await pickSource(B);
    await type("Wheat: total to send", "7");
    await release();
    expect(field("Wheat: total to send")!.value).toBe("7");
    expect(sendButton().textContent).toMatch(/^Send 1 good/);
    expect(host.querySelector('[data-pick="Send to:33"]')).toBeNull();
    expect(wheatSent()).toEqual([[A, 10]]);
  });

  it("leaves amounts and destinations changed while waiting as they are, even when a shipment is refused", async () => {
    world.answers.set(BigInt(B), "rejected");
    const release = holdAnswers();
    await open();
    await type("Wheat: total to send", "10");
    await send();
    await type("Wheat: total to send", "4");
    await toggle(B);
    await release();
    expect(field("Wheat: total to send")!.value).toBe("4");
    expect(field("Wheat to Beta")).toBeNull();
    expect(sendButton().textContent).toMatch(/^Send 1 good · /);
    expect(world.notices.failed).toHaveBeenCalledWith(expect.any(Error), expect.any(String), {
      description: "Nothing reached Beta.",
    });
  });

  it("keeps a late refusal chosen with its goods when the player changed nothing", async () => {
    world.answers.set(BigInt(B), "rejected");
    const release = holdAnswers();
    await open();
    await type("Wheat: total to send", "10");
    await send();
    await release();
    expect(field("Wheat to Alpha")).toBeNull();
    expect(field("Wheat: total to send")!.value).toBe("5");
    world.answers.set(BigInt(B), "applied");
    await send();
    expect(wheatSent()).toEqual([
      [A, 5],
      [B, 5],
    ]);
  });
});
