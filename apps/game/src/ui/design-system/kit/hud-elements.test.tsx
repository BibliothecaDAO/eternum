import { act, createRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HudButton,
  HudCard,
  HudField,
  HudIconButton,
  HudRow,
  HudSelect,
  HudSlider,
  HudTableRow,
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
