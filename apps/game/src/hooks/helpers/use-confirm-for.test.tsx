// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useConfirmFor } from "./use-confirm-for";

it("opens a confirm for its target only, and closes it for good when the target changes", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let confirm: ReturnType<typeof useConfirmFor> | null = null;
  const Probe = ({ target }: { target: string }) => {
    confirm = useConfirmFor(target);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe target="site A" />));
  act(() => confirm!.ask());
  expect(confirm!.confirming).toBe(true);
  act(() => root.render(<Probe target="site B" />));
  expect(confirm!.confirming).toBe(false);
  act(() => root.render(<Probe target="site A" />));
  expect(confirm!.confirming).toBe(false);
  act(() => confirm!.ask());
  act(() => confirm!.close());
  expect(confirm!.confirming).toBe(false);
  act(() => root.unmount());
});
