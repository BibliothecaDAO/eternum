// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio", () => ({ useUISound: () => () => {} }));

import { TroopAmount } from "./troop-amount";

let host: HTMLDivElement;
afterEach(() => host.remove());

/** The control as a form holds it: the count it shows is the last one it reported. */
const mount = (maxAffordable: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  const Form = () => {
    const [count, setCount] = useState(0);
    return <TroopAmount troopCount={count} maxAffordable={maxAffordable} onChange={setCount} disabled={false} />;
  };
  act(() => createRoot(host).render(<Form />));
  const button = (text: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === text)!;
  return {
    press: (text: string) => act(() => button(text).click()),
    button,
    count: () => host.querySelector<HTMLInputElement>("input")!.value,
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
});
