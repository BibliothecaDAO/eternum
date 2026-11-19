// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const network = vi.hoisted(() => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
});

import { ConnectFlow } from "@/shell/sign-in/connect-flow";
import { useDefaultWallet } from "@/hooks/context/default-wallet";
import { installLabChain } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";
import { LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";

it("keeps the playing ruin scenario clear of wallet onboarding and answers wallet reads locally", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await installLabChain(ruinFightScenario, Date.now());
  network.mockClear();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let retry = () => {};
  const Wallet = () => {
    const state = useDefaultWallet();
    retry = state.retry;
    return <output>{state.failed ? "failed" : state.wallet === null ? "none" : "unknown"}</output>;
  };
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <Wallet />
          <ConnectFlow />
        </MemoryRouter>,
      ),
    );
    expect(host.textContent).toBe("none");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => retry());
    expect(host.textContent).toBe("none");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(network).not.toHaveBeenCalled();

    await act(async () => {
      useIdentitySessionStore.getState().applySession(LAB_SESSION);
    });
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Create my wallet");
    expect(network).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
