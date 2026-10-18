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
    "stays blank while cleared in the %s, reporting nothing, until it loses focus",
    (_, render) => {
      const field = mountTyped(render);
      field.type("1,200");
      const reports = field.reported.length;
      field.type("");
      expect(field.input().value).toBe("");
      expect(field.reported).toHaveLength(reports);
      act(() => {
        field.input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
      expect(field.input().value).toBe("1,200");
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
