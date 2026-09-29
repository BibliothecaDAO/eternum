import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FrontierSheet } from "./frontier-sheet";

describe("Frontier's one sheet", () => {
  it("closes from its button, on Escape and on a tap outside, and a workspace closes the one already open", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onClose = vi.fn();
    act(() =>
      root.render(
        <FrontierSheet label="Build" onClose={onClose}>
          <p>plot</p>
        </FrontierSheet>,
      ),
    );
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    act(() => host.querySelector<HTMLButtonElement>("button[aria-hidden]")!.click());
    expect(onClose).toHaveBeenCalledTimes(3);

    // Two workspaces: opening the second closes the first, so only one sheet stands at a time.
    let openBoard: () => void = () => {};
    const Workspaces = () => {
      const [research, setResearch] = useState(true);
      const [board, setBoard] = useState(false);
      openBoard = () => setBoard(true);
      return (
        <>
          {research && (
            <FrontierSheet label="Research" workspace onClose={() => setResearch(false)}>
              <p>tree</p>
            </FrontierSheet>
          )}
          {board && (
            <FrontierSheet label="Season board" workspace onClose={() => setBoard(false)}>
              <p>board</p>
            </FrontierSheet>
          )}
        </>
      );
    };
    act(() => root.render(<Workspaces />));
    expect(host.querySelectorAll("[data-frontier-sheet]")).toHaveLength(1);
    act(() => openBoard());
    const sheets = [...host.querySelectorAll("[data-frontier-sheet]")].map((sheet) => sheet.getAttribute("aria-label"));
    expect(sheets).toEqual(["Season board"]);
    act(() => root.unmount());
    host.remove();
  });
});
