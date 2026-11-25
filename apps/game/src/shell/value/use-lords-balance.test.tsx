import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const ledger = vi.hoisted(() => ({ fail: false }));

vi.mock("./ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ledger")>()),
  environmentLedger: () => ({
    lordsToken: async () => {
      if (ledger.fail) throw new Error("RPC 429");
      return "0x124";
    },
    balanceOf: async () => 1_000n * 10n ** 18n,
  }),
}));

const { useLordsBalance } = await import("./use-lords-balance");

const seen: string[] = [];
const Reading = ({ owner }: { owner: string | null }) => {
  seen.push(String(useLordsBalance(owner).reading));
  return null;
};

const read = async (owner: string | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  seen.length = 0;
  const host = document.createElement("div");
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Reading owner={owner} />
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 300 && seen.at(-1) === "reading" && owner !== null; tick += 1)
    await act(() => new Promise((settled) => setTimeout(settled, 10)));
  act(() => root.unmount());
  return seen.at(-1);
};

afterEach(() => {
  ledger.fail = false;
  vi.restoreAllMocks();
});

it("says the LORDS are being read while no payer is known, and their amount once the ledger answers", async () => {
  expect(await read(null)).toBe("reading");
  expect(await read("0x7")).toBe("1000");
});

it("says the read failed, and logs it, when the ledger does not answer", async () => {
  ledger.fail = true;
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(await read("0x7")).toBe("failed");
  expect(logged).toHaveBeenCalledWith("lords_balance_read_failed", expect.any(Error));
});
