import { expect, test, mock } from "bun:test";
import approved from "../../config/source/frontier/extension.json";
import { extensionCalls, reconcileCalendar } from "./extend-frontier";
const proof = {
  chainId: approved.chainId,
  gameId: 1,
  start: approved.start,
  worldEnd: approved.end,
  ledgerEnd: approved.oldEnd,
  worldBlock: 90,
  ledgerBlock: 100,
  ledgerAddress: "0x123",
  pool: String(10n ** 24n),
  paid: "91",
  release: approved.release,
};
test("prepares the atomic admin upgrade and extension, never a funding or Blitz call", () => {
  expect(extensionCalls(proof, approved.previousLedgerClass, "0x2")).toEqual([
    { contractAddress: "0x123", entrypoint: "upgrade", calldata: ["0x2"] },
    { contractAddress: "0x123", entrypoint: "extend_frontier", calldata: [approved.chainId, "1"] },
  ]);
  expect(extensionCalls(proof, "0x2", "0x2")).toHaveLength(1);
  expect(() => extensionCalls(proof, "0x3", "0x2")).toThrow("unreviewed predecessor");
  expect(extensionCalls({ ...proof, ledgerEnd: approved.end }, "0x2", "0x2")).toEqual([]);
  expect(() => extensionCalls({ ...proof, worldEnd: approved.oldEnd }, approved.previousLedgerClass, "0x2")).toThrow(
    "Apply and confirm",
  );
});
test("reconciliation sends nothing until both clocks agree and safely retries a lost response", async () => {
  const dates = {
    phase: "frontier",
    presetId: 5,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.end * 1000).toISOString(),
  };
  let applied = false;
  const network = mock(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "PUT") {
      expect(JSON.parse(String(init.body))).toEqual({ presetId: 5, startsAt: dates.startsAt, endsAt: dates.endsAt });
      if (!applied) {
        applied = true;
        throw new Error("response lost");
      }
      return Response.json(dates);
    }
    return Response.json({ phases: [dates, { phase: "blitz", startsAt: "unchanged", endsAt: "unchanged" }] });
  }) as unknown as typeof fetch;
  await expect(reconcileCalendar(proof, "https://play.realms.party", "operator", network)).rejects.toThrow(
    "extension_not_confirmed_on_both_chains",
  );
  expect(network).not.toHaveBeenCalled();
  const confirmed = { ...proof, ledgerEnd: approved.end };
  await expect(reconcileCalendar(confirmed, "https://play.realms.party", "operator", network)).rejects.toThrow(
    "response lost",
  );
  expect(await reconcileCalendar(confirmed, "https://play.realms.party", "operator", network)).toEqual(dates);
});

test("refuses an unapproved target or missing operator token before any calendar request", async () => {
  const network = mock(async () => Response.json({})) as unknown as typeof fetch;
  const confirmed = { ...proof, ledgerEnd: approved.end };
  await expect(reconcileCalendar(confirmed, "https://dev.realms.party", "operator", network)).rejects.toThrow(
    "production",
  );
  await expect(reconcileCalendar(confirmed, "https://play.realms.party", "", network)).rejects.toThrow(
    "OPERATOR_TOKEN",
  );
  expect(network).not.toHaveBeenCalled();
  expect(() => extensionCalls(proof, approved.previousLedgerClass, "0x0")).toThrow("Invalid reviewed");
  expect(() => extensionCalls({ ...proof, ledgerEnd: approved.end + 1 }, approved.previousLedgerClass, "0x2")).toThrow(
    "Unapproved ledger end",
  );
});

test("requires a matching fresh calendar readback after an acknowledged write", async () => {
  const dates = {
    phase: "frontier",
    presetId: 5,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.end * 1000).toISOString(),
  };
  const network = mock(async (_url: unknown, init?: RequestInit) =>
    Response.json(
      init?.method === "PUT"
        ? dates
        : { phases: [{ ...dates, endsAt: new Date(approved.oldEnd * 1000).toISOString() }] },
    ),
  ) as unknown as typeof fetch;
  await expect(
    reconcileCalendar({ ...proof, ledgerEnd: approved.end }, "https://play.realms.party", "operator", network),
  ).rejects.toThrow("Calendar readback differs");
});

test.each(["write", "readback"])("extension reconciliation refuses a different preset in the %s", async (stage) => {
  const confirmed = { ...proof, ledgerEnd: approved.end };
  const dates = {
    phase: "frontier",
    presetId: approved.presetId,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.end * 1000).toISOString(),
  };
  const network = mock(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "PUT") return Response.json({ ...dates, presetId: stage === "write" ? 6 : dates.presetId });
    return Response.json({ phases: [{ ...dates, presetId: 6 }] });
  }) as unknown as typeof fetch;
  await expect(reconcileCalendar(confirmed, "https://play.realms.party", "operator", network)).rejects.toThrow(
    stage === "write" ? "Calendar write did not confirm" : "Calendar readback differs",
  );
});
