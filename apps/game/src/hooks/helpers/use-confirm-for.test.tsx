// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ id: "blitz" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => mode }));

import { useConfirmFor, useConfirmsLoss } from "./use-confirm-for";

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

/** What the rule answers in a game of the given mode, read through a mounted component as a caller reads it. */
const asksFirst = (id: string) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mode.id = id;
  const host = document.createElement("div");
  const root = createRoot(host);
  const Probe = () => <p>{String(useConfirmsLoss())}</p>;
  act(() => root.render(<Probe />));
  const answer = host.textContent;
  act(() => root.unmount());
  return answer;
};

it("asks before a loss that cannot be undone only in Frontier; Blitz, Eternum and a Duel act at once", () => {
  expect(asksFirst("frontier")).toBe("true");
  expect(asksFirst("blitz")).toBe("false");
  expect(asksFirst("eternum")).toBe("false");
  expect(asksFirst("duel")).toBe("false");
});
