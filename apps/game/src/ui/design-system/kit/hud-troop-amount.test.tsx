// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio", () => ({ useUISound: () => () => {} }));

import { HudNumberField, HudTransfer, HudTroopAmount } from "./hud-elements";

let host: HTMLDivElement;
afterEach(() => host.remove());

/** The control as a form holds it: the count it shows is the last one it reported. */
const mount = (maxAffordable: number, held = maxAffordable) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  const Form = () => {
    const [count, setCount] = useState(0);
    return <HudTroopAmount name="Troops" value={count} most={maxAffordable} held={held} onChange={setCount} />;
  };
  act(() => createRoot(host).render(<Form />));
  const button = (text: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === text)!;
  return {
    press: (text: string) => act(() => button(text).click()),
    button,
    count: () => host.querySelector<HTMLInputElement>("input")!.value,
    slider: () => host.querySelector<HTMLInputElement>('input[type="range"]')!,
    drag: (to: number) =>
      act(() => {
        const slider = host.querySelector<HTMLInputElement>('input[type="range"]')!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, String(to));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }),
    text: () => host.textContent,
  };
};

describe("the troop amount", () => {
  it("adds 500 with each press of +500, up to how many can go, and Max still takes them all", () => {
    const amount = mount(1_200);
    amount.press("+500");
    expect(amount.count()).toBe("500");
    amount.press("+500");
    expect(amount.count()).toBe("1,000");
    amount.press("+500");
    expect(amount.count()).toBe("1,200");
    expect(amount.button("+500").disabled).toBe(true);
    expect(amount.button("Max").disabled).toBe(true);
  });

  it("sets the count where its slider is dragged, over the same range, and follows the count set by the buttons", () => {
    const amount = mount(1_500);
    expect(amount.slider().getAttribute("aria-label")).toBe("Troops: how many go");
    expect(amount.slider().max).toBe("1500");

    amount.drag(1_250);
    expect(amount.count()).toBe("1,250");

    amount.press("Max");
    expect(amount.slider().value).toBe("1500");
  });

  it("goes to all of them with Max from any count", () => {
    const amount = mount(1_200);
    amount.press("Max");
    expect(amount.count()).toBe("1,200");
  });

  it("says the count is out of what fits when fewer fit than are held, so Max and +500 read against that", () => {
    // A guard of 1,000 into an army with room for 500: half the guard is not what Max or +500 measure.
    const amount = mount(500, 1_000);
    expect(amount.text()).toContain("of 500 that fit");
    amount.press("+500");
    expect(amount.count()).toBe("500");
    expect(mount(1_000, 1_000).text()).not.toContain("that fit");
  });
});

/** Types into a mounted field as a player does, the field's own input event included. */
const typeInto = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

/** An amount element as a form holds it, with every number it reported. */
const mountTyped = (render: (value: number, onChange: (next: number) => void) => React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  const reported: number[] = [];
  const Form = () => {
    const [value, setValue] = useState(0);
    return render(value, (next) => {
      reported.push(next);
      setValue(next);
    });
  };
  act(() => createRoot(host).render(<Form />));
  const input = () => host.querySelector<HTMLInputElement>("input:not([type=range])")!;
  return { reported, input, type: (text: string) => typeInto(input(), text) };
};

describe("a typed amount, as the game has always read it", () => {
  const elements = {
    "troop amount": (value: number, onChange: (next: number) => void) => (
      <HudTroopAmount name="Troops" value={value} most={3_000} held={3_000} onChange={onChange} />
    ),
    "transfer row": (value: number, onChange: (next: number) => void) => (
      <HudTransfer
        rows={[{ icon: "wheat", name: "Wheat", held: 3_000, value }]}
        onChange={(_, next) => onChange(next)}
      />
    ),
    "stepped field": (value: number, onChange: (next: number) => void) => (
      <HudNumberField label="Troops" value={value} max={3_000} step={100} onChange={onChange} />
    ),
  };

  it.each(Object.entries(elements))("keeps the sign, the whole part and the bounds in the %s", (_, render) => {
    const field = mountTyped(render);
    for (const [text, expected] of [
      ["-500", 0],
      ["1.5", 1],
      ["1,200", 1_200],
      ["99999", 3_000],
      ["abc", 0],
    ] as const) {
      field.type(text);
      expect(field.reported.at(-1), text).toBe(expected);
    }
  });

  it.each(Object.entries(elements))(
    "is its least once cleared in the %s: said at once, blank while focused, never the amount it held",
    (_, render) => {
      const field = mountTyped(render);
      field.type("1,200");
      field.type("");
      expect(field.input().value).toBe("");
      expect(field.reported.at(-1)).toBe(0);
      act(() => {
        field.input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      expect(field.input().value).toBe("0");
      expect(field.reported.at(-1)).toBe(0);
    },
  );
});

describe("the stepped field", () => {
  it("steps down and up by its step, within its bounds", () => {
    const field = mountTyped((value, onChange) => (
      <HudNumberField label="Stamina" value={value} min={0} max={150} step={100} onChange={onChange} />
    ));
    const step = (name: string) =>
      act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${name}: Stamina"]`)!.click());
    step("More");
    expect(field.reported.at(-1)).toBe(100);
    step("More");
    expect(field.reported.at(-1)).toBe(150);
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="More: Stamina"]')!.disabled).toBe(true);
    step("Fewer");
    expect(field.reported.at(-1)).toBe(50);
  });
});

describe("a decimal field", () => {
  const mountDecimal = () =>
    mountTyped((value, onChange) => (
      <HudNumberField label="Price" value={value} max={1_000_000} step={1} decimals onChange={onChange} />
    ));

  it("reads a fraction, thousands commas and the bounds as typed", () => {
    const field = mountDecimal();
    for (const [text, expected] of [
      ["0.25", 0.25],
      [".5", 0.5],
      ["1,200.75", 1_200.75],
      ["-2", 0],
      ["9999999", 1_000_000],
      ["abc", 0],
    ] as const) {
      field.type(text);
      expect(field.reported.at(-1), text).toBe(expected);
    }
  });

  it("keeps a fraction being typed on screen, then shows the number once it loses focus", () => {
    const field = mountDecimal();
    field.type("0.");
    expect(field.input().value).toBe("0.");
    expect(field.reported.at(-1)).toBe(0);
    field.type("0.05");
    expect(field.input().value).toBe("0.05");
    expect(field.reported.at(-1)).toBe(0.05);
    act(() => {
      field.input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(field.input().value).toBe("0.05");
  });
});

describe("an amount field's number", () => {
  it("shows a fraction the form computed as it is, and types whole units over it", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.append(host);
    const reported: number[] = [];
    act(() =>
      createRoot(host).render(
        <HudNumberField label="Wheat" value={12.5} max={100} onChange={(next) => reported.push(next)} />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>("input")!;
    expect(input.value).toBe("12.5");
    typeInto(input, "13.5");
    expect(reported).toEqual([13]);
  });
});
