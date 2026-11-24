import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signedIn: true,
  realmsId: "0x7" as string | null,
  payer: null as string | null,
  lords: null as number | null,
  sealHeld: false,
  getSealCode: vi.fn(),
  redeemSealCode: vi.fn(),
}));

vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  identityClient: {
    getSealCode: () => state.getSealCode(),
    redeemSealCode: (code: string) => state.redeemSealCode(code),
  },
  useIdentitySession: () =>
    state.signedIn
      ? {
          status: "signed-in",
          session: { user: { id: "u", realmsId: state.realmsId, name: "Maelis", image: "04" } },
        }
      : { status: "signed-out", session: null },
}));

vi.mock("./use-payer", () => ({
  usePayer: () => ({ payer: state.payer, passkey: false, failed: false, retry: vi.fn() }),
}));

vi.mock("./use-lords-balance", () => ({
  useLordsBalance: (owner: string | null) => ({
    owner,
    lords: owner !== null ? state.lords : null,
  }),
}));

import { PageFrame } from "../frame/page-frame";
import { setViewportWidth } from "../frame/test-viewport";
import { useRedeemSealCode } from "../play/seal-code";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  state.signedIn = true;
  state.realmsId = "0x7";
  state.payer = null;
  state.lords = null;
  state.sealHeld = false;
  state.getSealCode.mockReset();
  state.redeemSealCode.mockReset();
});

const RedeemProbe = ({ owner }: { owner: string | null }) => {
  const { redeem } = useRedeemSealCode(owner);
  return (
    <button type="button" data-redeem-probe onClick={() => redeem.mutate("SEAL2345")}>
      Redeem probe
    </button>
  );
};

const mountFrame = async (width: number, withProbe = false) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  state.getSealCode.mockImplementation(async () => ({ held: state.sealHeld }));
  state.redeemSealCode.mockImplementation(async () => {
    state.sealHeld = true;
    return { held: true };
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queries}>
        <MemoryRouter initialEntries={["/"]}>
          <PageFrame>{withProbe ? <RedeemProbe owner={state.realmsId} /> : <p>Play</p>}</PageFrame>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return { container, queries };
};

describe.each([
  ["desktop", 1440, "bar"],
  ["phone", 390, "top"],
] as const)("top-bar holdings on %s (%ipx)", (_label, width, bandName) => {
  const topBand = (rootEl: HTMLElement) => rootEl.querySelector<HTMLElement>(`[data-band="${bandName}"]`)!;

  it("hides all holdings and skips reading seal status while signed out", async () => {
    state.signedIn = false;
    state.payer = "0x123";
    state.lords = 40;
    state.sealHeld = true;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-topbar-holdings]")).toBeNull();
    expect(bar.querySelector("[data-lords-balance]")).toBeNull();
    expect(bar.querySelector("[data-seal-held]")).toBeNull();
    expect(state.getSealCode).not.toHaveBeenCalled();
  });

  it("shows only the LORDS pill when signed in with a wallet and no Ancient Seal held", async () => {
    state.payer = "0x123";
    state.lords = 40;
    state.sealHeld = false;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-lords-balance]")?.textContent).toBe("40");
    expect(bar.querySelector("[data-lords-balance]")?.getAttribute("aria-label")).toBe("40 LORDS");
    expect(bar.querySelector("[data-seal-held]")).toBeNull();
  });

  it("shows the Ancient Seal pill independently even without a linked wallet", async () => {
    state.payer = null;
    state.lords = null;
    state.sealHeld = true;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-lords-balance]")).toBeNull();
    const seal = bar.querySelector("[data-seal-held]")!;
    expect(seal).not.toBeNull();
    expect(seal.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
    expect(seal.getAttribute("title")).toBe("Your Ancient Seal is held");
    expect(seal.textContent).toBe("Ancient Seal");
  });

  it("shows LORDS and Ancient Seal side-by-side without adding interactive controls to the phone header", async () => {
    state.payer = "0x123";
    state.lords = 2500;
    state.sealHeld = true;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    const holdings = bar.querySelector("[data-topbar-holdings]")!;
    expect(holdings).not.toBeNull();
    expect(holdings.querySelector("[data-lords-balance]")?.textContent).toBe("2.5K");
    expect(holdings.querySelector("[data-seal-held]")?.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
    if (bandName === "top") {
      expect(bar.querySelectorAll("a[href], button, input, select, textarea")).toHaveLength(0);
    }
  });

  it("updates immediately when useRedeemSealCode saves a held seal into the shared query cache", async () => {
    state.payer = null;
    state.lords = null;
    state.sealHeld = false;
    const { container: rootEl } = await mountFrame(width, true);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-topbar-holdings]")).toBeNull();
    expect(state.getSealCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      rootEl.querySelector<HTMLButtonElement>("[data-redeem-probe]")!.click();
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(state.redeemSealCode).toHaveBeenCalledWith("SEAL2345");
    expect(bar.querySelector("[data-seal-held]")?.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
    expect(state.getSealCode).toHaveBeenCalledTimes(1);
  });
});
