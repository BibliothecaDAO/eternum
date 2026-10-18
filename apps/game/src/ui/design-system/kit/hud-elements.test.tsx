import { act, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HudButton,
  HudCard,
  HudConfirm,
  HudDeploy,
  HudEventRow,
  HudField,
  HudIconButton,
  HudRow,
  HudSelect,
  HudSlider,
  HudTableRow,
  HudTabs,
  HudTransfer,
  HudWindow,
  HudWindowFoot,
} from "./hud-elements";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const OPTIONS = [
  { value: "smart", label: "Smart" },
  { value: "custom", label: "Custom" },
  { value: "idle", label: "Idle", disabled: true },
  { value: "off", label: "Off" },
] as const;

const Automation = ({ onChange }: { onChange?: (value: string) => void }) => {
  const [mode, setMode] = useState<string>("smart");
  return (
    <HudSelect
      label="Automation"
      value={mode}
      options={OPTIONS}
      onChange={(value) => {
        setMode(value);
        onChange?.(value);
      }}
    />
  );
};

const trigger = () => host.querySelector<HTMLButtonElement>(".ui-select")!;
const menu = () => document.querySelector<HTMLElement>(".ui-select__layer .ui-menu");
const key = (target: Element, name: string) =>
  act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true })));

describe("a button whose press sends", () => {
  /** A press that sends, held open until the test settles it. */
  const sender = () => {
    let settle!: (failed: boolean) => void;
    const send = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = (failed) => (failed ? reject(new Error("refused")) : resolve());
        }),
    );
    return { send, settle: (failed = false) => settle(failed) };
  };
  const press = () => act(() => host.querySelector<HTMLButtonElement>("button")!.click());

  it.each([
    ["sent", false],
    ["refused", true],
  ] as const)("sends once while its send is in flight, and again once it is %s", async (_, failed) => {
    const { send, settle } = sender();
    const errors: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent | Error) => errors.push(event);
    process.on("unhandledRejection", onUnhandled);
    try {
      act(() =>
        root.render(
          <HudButton kind="primary" onClick={send}>
            Swap
          </HudButton>,
        ),
      );
      press();
      press();
      expect(send).toHaveBeenCalledTimes(1);
      expect(host.querySelector("button")!.disabled).toBe(true);
      expect(host.querySelector("button")!.getAttribute("aria-busy")).toBe("true");
      await act(async () => {
        settle(failed);
        await Promise.resolve();
      });
      expect(host.querySelector("button")!.disabled).toBe(false);
      press();
      expect(send).toHaveBeenCalledTimes(2);
      await act(async () => settle());
    } finally {
      await new Promise((resolve) => setTimeout(resolve));
      process.off("unhandledRejection", onUnhandled);
    }
    // A refused send stays the caller's to report: the button frees itself and lets the error through.
    expect(errors).toHaveLength(failed ? 1 : 0);
  });

  it("holds a confirm's verb the same way, and its way back stays open", async () => {
    const { send, settle } = sender();
    const back = vi.fn();
    act(() => root.render(<HudConfirm question="Swap?" verb="Swap" onConfirm={send} onBack={back} />));
    const button = (word: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === word)!;
    act(() => button("Swap").click());
    act(() => button("Swap").click());
    expect(send).toHaveBeenCalledTimes(1);
    act(() => button("Cancel").click());
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => settle());
    expect(button("Swap").disabled).toBe(false);
  });

  it("acts on every press when it sends nothing", () => {
    const toggle = vi.fn();
    act(() =>
      root.render(
        <HudButton kind="secondary" onClick={toggle}>
          Only mine
        </HudButton>,
      ),
    );
    press();
    press();
    expect(toggle).toHaveBeenCalledTimes(2);
  });
});

describe("a select", () => {
  it("shows what is chosen, opens its list on a press with the chosen one focused, and chooses on a press", () => {
    const chose = vi.fn();
    act(() => root.render(<Automation onChange={chose} />));
    expect(trigger().textContent).toBe("Smart");
    expect(menu()).toBeNull();

    act(() => trigger().click());
    expect([...menu()!.querySelectorAll(".ui-menu__item")].map((item) => item.textContent)).toEqual([
      "Smart",
      "Custom",
      "Idle",
      "Off",
    ]);
    expect(document.activeElement?.textContent).toBe("Smart");

    act(() => [...menu()!.querySelectorAll<HTMLButtonElement>(".ui-menu__item")][3].click());
    expect(chose).toHaveBeenCalledWith("off");
    expect(trigger().textContent).toBe("Off");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("moves through the choices it can take with the arrows, past one that is disabled, and wraps", () => {
    act(() => root.render(<Automation />));
    key(trigger(), "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Smart");
    key(menu()!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Custom");
    key(menu()!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Off");
    key(menu()!, "ArrowDown");
    expect(document.activeElement?.textContent).toBe("Smart");
    key(menu()!, "ArrowUp");
    expect(document.activeElement?.textContent).toBe("Off");
  });

  it("closes without choosing on Escape, back on its trigger, and on a press outside", () => {
    const chose = vi.fn();
    act(() => root.render(<Automation onChange={chose} />));
    act(() => trigger().click());
    key(menu()!, "Escape");
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());

    act(() => trigger().click());
    act(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect(menu()).toBeNull();

    // A scroll under the open list moves its trigger away: the list closes rather than float apart from it.
    act(() => trigger().click());
    act(() => document.dispatchEvent(new Event("scroll")));
    expect(menu()).toBeNull();
    expect(chose).not.toHaveBeenCalled();
    expect(trigger().textContent).toBe("Smart");
  });
});

describe("a row pressed to choose it", () => {
  it("is a button that says it is chosen, and a disabled one cannot be pressed", () => {
    const pick = vi.fn();
    act(() =>
      root.render(
        <>
          <HudRow title="Hetokamohuti" detail="lands in 2 min" selected onClick={() => pick("Hetokamohuti")} />
          <HudRow title="Stolsli" disabled onClick={() => pick("Stolsli")} />
        </>,
      ),
    );
    const [chosen, sender] = [...host.querySelectorAll<HTMLButtonElement>("button.ui-row")];
    expect(chosen.getAttribute("aria-selected")).toBe("true");
    act(() => chosen.click());
    act(() => sender.click());
    expect(pick.mock.calls).toEqual([["Hetokamohuti"]]);
  });
});

describe("a slider", () => {
  it("reports where it is dragged to, and fills its track to that share of its most", () => {
    const moved = vi.fn();
    act(() => root.render(<HudSlider label="Labor" value={25} max={100} onChange={moved} />));
    const range = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(range.style.getPropertyValue("--fill")).toBe("25%");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      set.call(range, "60");
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(moved).toHaveBeenCalledWith(60);
  });
});

describe("a transfer row", () => {
  it("names its total and its share by the good, and has the total ready to type on the row it opened for", () => {
    const changed = vi.fn();
    act(() =>
      root.render(
        <HudTransfer
          rows={[
            { icon: "wheat", name: "Wheat", held: 6_400, value: 1_200 },
            { icon: "wood", name: "Wood", held: 2_100, value: 0, focus: true },
          ]}
          onChange={changed}
        />,
      ),
    );
    const total = host.querySelector<HTMLInputElement>('input[aria-label="Wheat: total to send"]')!;
    expect(total.value).toBe("1,200");
    expect(host.querySelector('input[aria-label="Wheat: share to send"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Wood: total to send");
  });
});

describe("a tab's count", () => {
  it("takes the tone it is given", () => {
    act(() =>
      root.render(
        <HudTabs
          tabs={[{ key: "arrivals", label: "Arrivals", count: 2, countTone: "good" }]}
          value="arrivals"
          onChange={() => undefined}
        />,
      ),
    );
    expect(host.querySelector(".ui-chip")?.getAttribute("data-tone")).toBe("good");
  });
});

describe("a card", () => {
  it("is chosen by its one button, and an action pressed on it never chooses it", () => {
    const choose = vi.fn();
    const build = vi.fn();
    act(() =>
      root.render(
        <HudCard
          title="Farm"
          picture={<img alt="" />}
          detail="+360 Wheat / min"
          actions={<HudIconButton icon="build" label="Build" onClick={build} />}
          selected
          onClick={choose}
        />,
      ),
    );
    const chooser = host.querySelector<HTMLButtonElement>(".ui-card__choose")!;
    expect(chooser.getAttribute("aria-pressed")).toBe("true");
    expect(chooser.querySelector("button")).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Build"]')!.click());
    expect([build.mock.calls.length, choose.mock.calls.length]).toEqual([1, 0]);
    act(() => chooser.click());
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it("says on its foot why it cannot be chosen, and its button reads that reason", () => {
    const choose = vi.fn();
    act(() =>
      root.render(
        <HudCard
          title="Farm"
          picture={<img alt="" />}
          disabled
          refusal="Needs a free building tile"
          onClick={choose}
        />,
      ),
    );
    const chooser = host.querySelector<HTMLButtonElement>(".ui-card__choose")!;
    const reason = document.getElementById(chooser.getAttribute("aria-describedby")!);
    expect(reason?.textContent).toBe("Needs a free building tile");
    act(() => chooser.click());
    expect(choose).not.toHaveBeenCalled();
  });
});

describe("a table row", () => {
  it("is pressed to choose it when it leads somewhere, and only read in a reference table when it does not", () => {
    const pick = vi.fn();
    act(() =>
      root.render(
        <div role="table" aria-label="Rewards">
          <HudTableRow cols="1fr 64px" label="djizus: their points" onClick={pick}>
            <span>djizus</span>
          </HudTableRow>
          <HudTableRow cols="1fr 64px" label="Essence: 30 percent">
            <span role="cell">Essence</span>
          </HudTableRow>
        </div>,
      ),
    );
    const [pressed, read] = [...host.querySelectorAll(".ui-table-row")];
    act(() => (pressed as HTMLButtonElement).click());
    expect([pressed.tagName, read.tagName, read.getAttribute("role")]).toEqual(["BUTTON", "DIV", "row"]);
    expect(read.getAttribute("aria-label")).toBe("Essence: 30 percent");
    expect(pick).toHaveBeenCalledTimes(1);
  });
});

describe("a field", () => {
  it("passes an input's own props through and reports what is typed", () => {
    const typed = vi.fn();
    const ref = createRef<HTMLInputElement>();
    act(() =>
      root.render(<HudField ref={ref} value="Egonal" maxLength={30} aria-label="Realm name" onChange={typed} />),
    );
    expect(ref.current?.getAttribute("aria-label")).toBe("Realm name");
    expect(ref.current?.maxLength).toBe(30);
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      set.call(ref.current, "Egonal II");
      ref.current!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(typed).toHaveBeenCalledWith("Egonal II");
  });
});

describe("an event row", () => {
  it("goes where it happened when pressed, and its action acts alone", () => {
    const open = vi.fn();
    const retry = vi.fn();
    act(() =>
      root.render(
        <HudEventRow
          time="12:09"
          icon="military"
          onOpen={open}
          trail={
            <HudButton kind="quiet" size="sm" onClick={retry}>
              Retry
            </HudButton>
          }
        >
          Kestrel beat you
        </HudEventRow>,
      ),
    );
    const [row, action] = [...host.querySelectorAll("button")];
    expect(row.textContent).toBe("12:09Kestrel beat you");
    act(() => action.click());
    expect([open.mock.calls.length, retry.mock.calls.length]).toEqual([0, 1]);
    act(() => row.click());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("is only read without a way to go there", () => {
    act(() => root.render(<HudEventRow tone="bad">Offline</HudEventRow>));
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector(".ui-event__time")).toBeNull();
    expect(host.textContent).toBe("Offline");
  });
});

describe("a window", () => {
  it("is dragged by its bar and closed by its way out", () => {
    const close = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    act(() =>
      root.render(
        <HudWindow title="Edit structure" size="task" onClose={close}>
          body
        </HudWindow>,
      ),
    );
    expect(host.querySelector("[data-popover-drag-handle]")?.textContent).toBe("Edit structure");
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("holds in its one foot what its body puts there, from wherever the verb's state lives, and nothing else", () => {
    const ref = createRef<HTMLButtonElement>();
    const Form = () => {
      const [count, setCount] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setCount(500)}>
            +500
          </button>
          <section>
            <HudWindowFoot note={`Costs ${count} wheat`}>
              <HudButton ref={ref} kind="primary">
                Deploy
              </HudButton>
            </HudWindowFoot>
          </section>
        </div>
      );
    };
    act(() =>
      root.render(
        <HudWindow title="Military" onClose={() => undefined}>
          <Form />
        </HudWindow>,
      ),
    );
    const foot = () => host.querySelector("footer.ui-window__foot")!;
    expect(foot().textContent).toBe("Costs 0 wheatDeploy");
    expect(foot().contains(ref.current)).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>(".ui-window__body button")!.click());
    expect(foot().textContent).toBe("Costs 500 wheatDeploy");
    expect(host.querySelectorAll("footer")).toHaveLength(1);
  });

  it("leaves its foot empty, to be hidden, when the body puts nothing there", () => {
    act(() =>
      root.render(
        <HudWindow title="Leaderboard" onClose={() => undefined}>
          rows
        </HudWindow>,
      ),
    );
    expect(host.querySelector("footer.ui-window__foot")!.childNodes).toHaveLength(0);
  });
});

describe("deploying an army", () => {
  const TROOPS = [
    {
      name: "Knights",
      stacks: [
        { key: "knight-t1", icon: "knight-t1", tier: 1, held: 2_400 },
        { key: "knight-t2", icon: "knight-t2", tier: 2, held: 0 },
      ],
    },
    { name: "Paladins", stacks: [{ key: "paladin-t3", icon: "paladin-t3", tier: 3, held: 120 }] },
  ] as const;
  const stacks = () => [...host.querySelectorAll<HTMLButtonElement>(".ui-deploy__troop .ui-button")];

  it("draws a column per troop with every tier in place, an empty one disabled, the chosen one pressed", () => {
    const choose = vi.fn();
    act(() =>
      root.render(
        <HudDeploy troops={TROOPS} chosen="knight-t1" onChoose={choose} value={500} most={1_800} onChange={vi.fn()} />,
      ),
    );
    expect([...host.querySelectorAll(".ui-deploy__name")].map((name) => name.textContent)).toEqual([
      "Knights",
      "Paladins",
    ]);
    expect(stacks().map((stack) => stack.getAttribute("aria-label"))).toEqual([
      "Knights T1, 2,400 held",
      "Knights T2, 0 held",
      "Paladins T3, 120 held",
    ]);
    expect(stacks().map((stack) => [stack.disabled, stack.getAttribute("aria-pressed")])).toEqual([
      [false, "true"],
      [true, "false"],
      [false, "false"],
    ]);
    act(() => stacks()[2].click());
    expect(choose).toHaveBeenCalledWith("paladin-t3");
  });

  it("shuts a held stack this deploy cannot take, still saying what it holds", () => {
    const choose = vi.fn();
    const locked = [
      { name: "Knights", stacks: [{ key: "knight-t1", icon: "knight-t1", tier: 1, held: 2_400, disabled: true }] },
      { name: "Paladins", stacks: [{ key: "paladin-t3", icon: "paladin-t3", tier: 3, held: 120 }] },
    ] as const;
    act(() =>
      root.render(
        <HudDeploy troops={locked} chosen="paladin-t3" onChoose={choose} value={100} most={120} onChange={vi.fn()} />,
      ),
    );
    expect(stacks().map((stack) => [stack.getAttribute("aria-label"), stack.disabled])).toEqual([
      ["Knights T1, 2,400 held", true],
      ["Paladins T3, 120 held", false],
    ]);
    act(() => stacks()[0].click());
    expect(choose).not.toHaveBeenCalled();
  });

  it("shuts the amount when none of the chosen stack can go", () => {
    act(() =>
      root.render(
        <HudDeploy troops={TROOPS} chosen="knight-t2" onChoose={vi.fn()} value={0} most={0} onChange={vi.fn()} />,
      ),
    );
    expect(host.querySelector("input")?.disabled).toBe(true);
    expect(host.querySelector(".ui-amount__of")?.textContent).toBe("of 0");
  });

  it("puts the chosen stack's amount under the columns, with +500, Max and what fits", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <HudDeploy troops={TROOPS} chosen="knight-t1" onChoose={vi.fn()} value={500} most={1_800} onChange={change} />,
      ),
    );
    expect(host.querySelector("input")?.getAttribute("aria-label")).toBe("Knights T1");
    expect(host.querySelector(".ui-amount__of")?.textContent).toBe("of 1,800 that fit");
    const max = [...host.querySelectorAll<HTMLButtonElement>(".ui-amount .ui-button")].find(
      (button) => button.textContent === "Max",
    )!;
    act(() => max.click());
    expect(change).toHaveBeenCalledWith(1_800);
  });
});

describe("a question that stops the task", () => {
  it("draws its verb as the danger button when it cannot be undone, and as the primary otherwise", () => {
    const verb = () => [...host.querySelectorAll<HTMLButtonElement>(".ui-button")].at(-1)!;
    act(() =>
      root.render(
        <HudConfirm question="Disband this army?" verb="Disband" tone="bad" onConfirm={vi.fn()} onBack={vi.fn()} />,
      ),
    );
    expect([verb().textContent, verb().dataset.kind]).toEqual(["Disband", "danger"]);
    act(() => root.render(<HudConfirm question="Send 300 wheat?" verb="Send" onConfirm={vi.fn()} onBack={vi.fn()} />));
    expect([verb().textContent, verb().dataset.kind]).toEqual(["Send", "primary"]);
  });
});
