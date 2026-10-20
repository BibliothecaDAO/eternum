import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { PlayerName } from "./player-name";

/** Identity's answer for the profiles asked, held until `answer` lets it through; an ask for 0x5eed0789 fails. */
let answer: () => void = () => {};
vi.stubGlobal(
  "fetch",
  (url: string) =>
    new Promise<Response>((resolve, reject) => {
      const account = new URL(url).searchParams.get("accounts")!;
      answer =
        account === "0x5eed0789"
          ? () => reject(new TypeError("Failed to fetch"))
          : () => resolve(Response.json({ profiles: { [account]: { name: "Maelis", portrait: "04" } } }));
    }),
);

it("shows that a player's name is on its way, never the address's stand-in, until identity answers (qa-app-1 P3-4)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PlayerName account="0x5eed0292" portrait />));
    // Waiting: a muted bar and an empty ring, not "Lord 0292" and a stock face.
    expect(container.textContent).not.toMatch(/Lord/);
    expect(container.querySelector("[aria-busy]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe("Maelis");
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("[aria-busy]")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("says a player's name is unavailable when identity's ask fails, never the stand-in", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PlayerName account="0x5eed0789" portrait />));
    expect(container.querySelector("[aria-busy]")).not.toBeNull();
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe("—");
    expect(container.querySelector('[aria-label="Name unavailable"]')).not.toBeNull();
    expect(container.querySelector("[aria-busy]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
