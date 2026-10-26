// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AUDIT_ADDRESS, UiUsageView } from "./ui-usage";

const finding = (title: string, modes: string[], shot: string | null) => ({
  title,
  modes,
  kind: "command",
  where: `${title} where`,
  evidence: `${title} evidence`,
  replace: "Nothing.",
  risk: "Low.",
  shot,
});
const AUDIT = {
  title: "What players never use",
  pulled: "2026-10-26 09:09 UTC",
  source: "Prod chain.",
  rerun: "python3 classify-commands.py",
  caveat: "Few Blitz players.",
  findings: [
    finding("Burn", ["blitz"], "burn.png"),
    finding("Reach", ["frontier"], null),
    finding("Rename", ["blitz", "frontier"], "rename.png"),
  ],
  kept: ["Explore 3,283"],
  outOfScope: ["Trade"],
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const open = async (at: string, served: string) => {
  const fetched = vi.fn(async () => new Response(served, { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <UiUsageView />
      </MemoryRouter>,
    ),
  );
  return fetched;
};
const rows = () => [...host.querySelectorAll(".ui-usage-row h2")].map((row) => row.textContent);

it("lists the game's findings in the audit's rank, each beside its screenshot", async () => {
  const fetched = await open("/lab/data/usage?mode=blitz", JSON.stringify(AUDIT));
  expect(fetched).toHaveBeenCalledWith(`${AUDIT_ADDRESS}/findings.json`);
  expect(rows()).toEqual(["1 BurnCounted on chain", "3 RenameCounted on chain"]);
  expect([...host.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
    `${AUDIT_ADDRESS}/burn.png`,
    `${AUDIT_ADDRESS}/rename.png`,
  ]);
  expect(host.textContent).toContain("Burn evidence");
  expect(host.textContent).toContain("Explore 3,283");
});

it("shows Frontier's findings by default, saying when a finding has no screenshot", async () => {
  await open("/lab/data/usage", JSON.stringify(AUDIT));
  expect(rows()).toEqual(["2 ReachCounted on chain", "3 RenameCounted on chain"]);
  expect(host.textContent).toContain("No lab fixture draws it.");
});

it("says where to link the audit when the server has none", async () => {
  await open("/lab/data/usage", "<!doctype html>");
  expect(host.textContent).toContain("No usage audit on this server");
});
