import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Abi, AccountInterface } from "starknet";
import { EternumProvider } from "@bibliothecadao/provider";
import bindings from "../../../../../../contracts/l3/world-native/schema/bindings.json";

const game = vi.hoisted(() => ({ provider: null as EternumProvider | null }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { network: { provider: game.provider }, store: { get: () => undefined } } }),
}));
vi.mock("@/observability/transaction-failure-reporting", () => ({
  addClientTransactionBreadcrumb: vi.fn(),
  reportClientTransactionFailure: vi.fn(),
}));
vi.mock("@/observability/client-action-latency", () => ({ recordAdmissionToVisible: vi.fn() }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => undefined }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => vi.fn() }));

import { useTransactionListener } from "@/hooks/use-transaction-listener";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { deriveFeedRows } from "./event-feed-rows";
import { FeedRowLine } from "./feed-row-line";
import { selectImportantFeedRows } from "./important-feed-rows";

const signer = { address: "0x111" } as AccountInterface;
const Listener = () => {
  useTransactionListener();
  return null;
};

afterEach(() => {
  useTransactionStore.getState().clearAllTransactions();
  vi.restoreAllMocks();
});

/**
 * Every action whose success notice was removed is told by its own transaction row, so that row must say what
 * succeeded. Each case drives the real provider method, its encoded command, the transaction listener and store, the
 * feed's selection and the drawn row, with only the send and its outcome stubbed.
 */
it.each([
  [
    "a transfer",
    (p: EternumProvider) =>
      p.send_resources_multiple({
        signer,
        calls: [{ sender_entity_id: 3, recipient_entity_id: 4, resources: [3, 1_000] }],
      }),
    "Caravan sent",
  ],
  ["auto-provisioning", (p: EternumProvider) => p.provision_realm({ signer, realm_entity_id: 3 }), "Realm provisioned"],
  [
    "a crate opening",
    (p: EternumProvider) => p.open_chest({ signer, explorer_id: 9, chest_coord: { alt: false, x: 3, y: 4 } }),
    "Crate opened",
  ],
  [
    "a guard dismissal",
    (p: EternumProvider) => p.guard_delete({ signer, for_structure_id: 3, slot: 0 }),
    "Guard dismissed",
  ],
  ["devotion", (p: EternumProvider) => p.pledge_faith({ signer, structure_id: 3, wonder_id: 5 }), "Faith pledged"],
  [
    "mining labor",
    (p: EternumProvider) => p.bitcoin_mine_contribute_labor({ signer, structure_id: 3, labor_amount: 10 }),
    "Labor sent to the mine",
  ],
  [
    "a mining phase closed",
    (p: EternumProvider) => p.bitcoin_mine_close_phase({ signer, phase_id: 2 }),
    "Mining phase closed",
  ],
  [
    "a mine bound to its phase",
    (p: EternumProvider) => p.bitcoin_mine_bind_phase({ signer, phase_id: 2 }),
    "Mine joined the mining phase",
  ],
  [
    "an ownership transfer",
    (p: EternumProvider) => p.transfer_structure_ownership({ signer, structure_id: 3, new_owner: "0x222" }),
    "Structure ownership transferred",
  ],
  [
    "a hyperstructure's construction started",
    (p: EternumProvider) => p.initialize({ signer, hyperstructure_id: 3 }),
    "Hyperstructure construction started",
  ],
  [
    "a hyperstructure contribution",
    (p: EternumProvider) =>
      p.contribute_to_construction({
        signer,
        hyperstructure_entity_id: 3,
        contributor_entity_id: 4,
        contributions: [{ resource: 3, amount: 1_000 }],
      }),
    "Resources given to the hyperstructure",
  ],
  [
    "construction access",
    (p: EternumProvider) => p.set_access({ signer, hyperstructure_entity_id: 3, access: 0 }),
    "Access updated",
  ],
  [
    "a reserved hyperstructure founded",
    (p: EternumProvider) => p.create_hyperstructure({ signer, x: 3, y: 4, alt: false }),
    "Hyperstructure founded",
  ],
] as const)("names %s in its one row, with no story to correct it", async (_action, send, words) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const provider = new EternumProvider({ world: "0x77" }, "http://127.0.0.1:1", { gameId: 7 });
  provider.setNativeSubmission(
    async () => ({ transaction_hash: "0x99" }),
    bindings.commandAbi as Abi,
    () => 3,
  );
  provider.setTransactionStreamWaiter(async (hash) => ({ hash, block: 4, status: "PRE_CONFIRMED" }));
  game.provider = provider;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<Listener />));
    await act(async () => {
      await send(provider);
    });
    await vi.waitFor(() => expect(useTransactionStore.getState().transactions[0]?.status).toBe("success"));
    const feed = deriveFeedRows({ transactions: useTransactionStore.getState().transactions, notices: [] });
    const rows = selectImportantFeedRows([], feed, "all", "0x111");
    expect(rows).toHaveLength(1);
    act(() => root.render(<FeedRowLine row={rows[0]} />));
    expect(host.textContent).toContain(words);
    expect(host.textContent).toContain("Done");
    expect(host.textContent).not.toContain("undefined");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
