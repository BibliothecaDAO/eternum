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
  games: [] as DirectoryGame[],
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

vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useDirectory: () => ({ data: { games: state.games } }),
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
import type { DirectoryGame } from "../herald";
import { useRedeemSealCode } from "../play/seal-code";
import { ANCIENT_SEAL } from "@bibliothecadao/types";

const directoryGame = (fragments: number | null, ancient_seal: boolean): DirectoryGame =>
  ({
    chainId: "0xa",
    game_id: 1,
    name: "frontier-1",
    mode: "frontier",
    status: "Live",
    clock_scale: 1,
    clock: { start_settling_at: 0, start_main_at: 1, scheduled_end_at: 9_000, end_at: 9_000 },
    player_state: {
      registered: true,
      settled: true,
      held_realm_id: null,
      has_home_source: false,
      taken_realm_ids: [],
      structures: [],
      fragments,
      ancient_seal,
    },
  }) as unknown as DirectoryGame;

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
  state.games = [];
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
    state.games = [directoryGame(1_500, true)];
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-topbar-holdings]")).toBeNull();
    expect(bar.querySelector("[data-lords-balance]")).toBeNull();
    expect(bar.querySelector("[data-fragments-balance]")).toBeNull();
    expect(bar.querySelector("[data-seal-held]")).toBeNull();
    expect(state.getSealCode).not.toHaveBeenCalled();
  });

  it("shows only the LORDS pill when signed in with a wallet and no Fragments or Ancient Seal held", async () => {
    state.payer = "0x123";
    state.lords = 40;
    state.sealHeld = false;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-lords-balance]")?.textContent).toBe("40");
    expect(bar.querySelector("[data-lords-balance]")?.getAttribute("aria-label")).toBe("40 LORDS");
    expect(bar.querySelector("[data-fragments-balance]")).toBeNull();
    expect(bar.querySelector("[data-seal-held]")).toBeNull();
  });

  it("shows the Ancient Seal pill independently even without a linked wallet", async () => {
    state.payer = null;
    state.lords = null;
    state.sealHeld = true;
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-lords-balance]")).toBeNull();
    expect(bar.querySelector("[data-fragments-balance]")).toBeNull();
    const seal = bar.querySelector("[data-seal-held]")!;
    expect(seal).not.toBeNull();
    expect(seal.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
    expect(seal.getAttribute("title")).toBe("Your Ancient Seal is held");
    expect(seal.textContent).toBe(ANCIENT_SEAL);
  });

  it("shows LORDS, Fragments, and exactly one Ancient Seal when both a redeemed code and an on-chain seal are held", async () => {
    state.payer = "0x123";
    state.lords = 2500;
    state.sealHeld = true;
    state.games = [directoryGame(1_500, true)];
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    const holdings = bar.querySelector("[data-topbar-holdings]")!;
    expect(holdings).not.toBeNull();
    expect(
      Array.from(holdings.children).map((el) => el.getAttributeNames().find((a) => a.startsWith("data-"))),
    ).toEqual(["data-lords-balance", "data-fragments-balance", "data-seal-held"]);
    expect(holdings.querySelector("[data-lords-balance]")?.textContent).toBe("2.5K");
    const fragments = holdings.querySelector("[data-fragments-balance]")!;
    expect(fragments.textContent).toBe("1.5K");
    expect(fragments.getAttribute("aria-label")).toBe("1.5K Fragments");
    expect(fragments.querySelector('[data-icon="final-seal"]')).toBeNull();
    expect(bar.querySelectorAll("[data-seal-held]")).toHaveLength(1);
    expect(bar.querySelectorAll('[data-icon="final-seal"]')).toHaveLength(1);
    expect(holdings.querySelector("[data-seal-held]")?.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
    if (bandName === "top") {
      expect(bar.querySelectorAll("a[href], button, input, select, textarea")).toHaveLength(0);
    }
  });

  it("shows an on-chain Ancient Seal and hides Fragments when the game sells no Fragments", async () => {
    state.payer = null;
    state.lords = null;
    state.sealHeld = false;
    state.games = [directoryGame(null, true)];
    const { container: rootEl } = await mountFrame(width);
    const bar = topBand(rootEl);
    expect(bar.querySelector("[data-lords-balance]")).toBeNull();
    expect(bar.querySelector("[data-fragments-balance]")).toBeNull();
    expect(bar.querySelectorAll("[data-seal-held]")).toHaveLength(1);
    expect(bar.querySelectorAll('[data-icon="final-seal"]')).toHaveLength(1);
    expect(bar.querySelector("[data-seal-held]")?.getAttribute("aria-label")).toBe("Your Ancient Seal is held");
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
