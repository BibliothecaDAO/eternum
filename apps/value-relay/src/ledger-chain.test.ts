import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { onIdentityChain } from "./ledger-chain";
const chain = vi.hoisted(() => vi.fn());
vi.mock("@realms-world/value-ledger", () => ({ rpcAt: () => ({ getChainId: chain }) }));
it("refuses signing on a different ledger chain without running a link, pay or opening", async () => {
  chain.mockResolvedValue("0x534e5f4d41494e");
  const execute = vi.fn(async (_name: string) => {});
  const identity = { l2ChainId: async () => "0x534e5f5345504f4c4941" };
  for (const name of ["link", "pay", "openBlitz"])
    await expect(
      Effect.runPromise(
        onIdentityChain(
          "https://ledger.test",
          identity,
          Effect.promise(() => execute(name)),
        ),
      ),
    ).rejects.toMatchObject({ operation: "ledger_identity_chain_mismatch" });
  expect(execute).not.toHaveBeenCalled();
  chain.mockResolvedValue("0x534e5f5345504f4c4941");
  await Effect.runPromise(
    onIdentityChain(
      "https://ledger.test",
      identity,
      Effect.promise(() => execute("link")),
    ),
  );
  expect(execute).toHaveBeenCalledOnce();
});
