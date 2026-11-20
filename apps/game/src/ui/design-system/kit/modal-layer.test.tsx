import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { AppModalLayer } from "./app-elements";
import { HudModalLayer } from "./hud-elements";

it("keeps the shell dialog usable over a required game choice, then restores the choice", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Choices = () => {
    const [wallet, setWallet] = useState(false);
    const [oath, setOath] = useState(false);
    return (
      <>
        <button
          onClick={() => {
            setWallet(true);
            setOath(true);
          }}
        >
          Map order
        </button>
        {oath && (
          <HudModalLayer>
            <section role="dialog" aria-label="Oath">
              <button onClick={() => setOath(false)}>Pass</button>
            </section>
          </HudModalLayer>
        )}
        {wallet && (
          <AppModalLayer onClose={() => setWallet(false)}>
            <section role="dialog" aria-label="Wallet">
              <button onClick={() => setWallet(false)}>Close wallet</button>
            </section>
          </AppModalLayer>
        )}
      </>
    );
  };
  const dialog = (name: string) => document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`)!;
  try {
    await act(async () => root.render(<Choices />));
    const opener = host.querySelector("button")!;
    opener.focus();
    await act(async () => opener.click());
    expect(dialog("Wallet").closest("[inert]")).toBeNull();
    expect(dialog("Oath").closest("[inert]")).not.toBeNull();
    const walletClose = dialog("Wallet").querySelector("button")!;
    walletClose.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(walletClose);
    await act(async () => walletClose.click());
    expect(dialog("Wallet")).toBeNull();
    expect(dialog("Oath").closest("[inert]")).toBeNull();
    expect(host.querySelector("button")!.closest("[inert]")).not.toBeNull();
    await act(async () => dialog("Oath").querySelector("button")!.click());
    expect(dialog("Oath")).toBeNull();
    expect(host.querySelector("button")!.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
