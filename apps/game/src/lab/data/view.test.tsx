// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./research-balance/research-balance-lab", () => ({ ResearchBalanceLab: () => <p>Research study</p> }));
const { DataRoomView, PULL_ADDRESS } = await import("./view");

/** A pull as live-data.py prints it: Frontier's tables, then Blitz's, then the value ledger. */
const PULL = `# Frontier live data, game 1, pulled 2026-10-25T17:24:19.638439+00:00

## Players

| day | active |
|---|---|
| 0 | 18 |

# Blitz

Games listed: 13.

# Value ledger (Starknet mainnet, read-only)

Entry fees: 1,300 LORDS.
`;

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const open = async (at: string, served: string | undefined) => {
  const fetched = vi.fn(async () => new Response(served ?? "<!doctype html>", { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <DataRoomView />
      </MemoryRouter>,
    ),
  );
  return fetched;
};

it("shows Frontier's tables from perf's newest pull, with when it was taken, and the ledger", async () => {
  const fetched = await open("/lab/data?mode=frontier", PULL);
  expect(fetched).toHaveBeenCalledWith(PULL_ADDRESS);
  expect(host.textContent).toContain("Perf's pull of 2026-10-25 17:24 UTC");
  expect(host.querySelector("table td")?.textContent).toBe("0");
  expect(host.textContent).toContain("Entry fees: 1,300 LORDS.");
  expect(host.textContent).not.toContain("Games listed");
});

it("shows Blitz's part of the pull for Blitz, with no research study to pick", async () => {
  await open("/lab/data?mode=blitz", PULL);
  expect(host.textContent).toContain("Games listed: 13.");
  expect(host.textContent).not.toContain("Players");
  expect(host.textContent).not.toContain("Research balance");
});

it("says how to pull when the server has no pull", async () => {
  await open("/lab/data?mode=frontier", undefined);
  expect(host.textContent).toContain("No pull on this server");
  expect(host.textContent).toContain("live-data.py all");
});

it("opens next season's research balance study on its tab", async () => {
  await open("/lab/data?mode=frontier&view=balance", PULL);
  expect(host.textContent).toContain("Research study");
});
