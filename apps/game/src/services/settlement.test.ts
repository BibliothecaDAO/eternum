// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountInterface } from "starknet";
import type { WorldConfigMeta } from "@/hooks/use-world-availability";
import { submitSettlement } from "./settlement";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  directory: vi.fn(),
  world: vi.fn(),
  connect: vi.fn(),
  dispose: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("./game-client", () => ({ createBrowserGameClient: mocks.create }));
vi.mock("@/runtime/world/world-directory", () => ({ requireWorldById: mocks.world }));
vi.mock("@bibliothecadao/eternum/game-client", () => ({ fetchHeraldGameDirectory: mocks.directory }));

const meta = { gameId: 7, worldId: "blitz" } as WorldConfigMeta;
const world = { playerRegistryAddress: "0x777" };
const client = { connect: mocks.connect, dispose: mocks.dispose, runtime: { waitForTransaction: mocks.wait } };
const ownerLookup = vi.fn();
const signer = { address: "0x123", callContract: ownerLookup } as unknown as AccountInterface;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.world.mockReturnValue(world);
  mocks.directory.mockResolvedValue({ games: [{ game_id: 7, preset_id: 2 }] });
  mocks.create.mockResolvedValue(client);
  ownerLookup.mockResolvedValue(["0x456"]);
});

describe("native settlement", () => {
  it("loads the selected game's preset, connects its actor and submits with the registry binding", async () => {
    const receipt = { transaction_hash: "0xabc", statusReceipt: "PENDING" };
    const submit = vi.fn(async () => receipt);
    expect(await submitSettlement(meta, signer, submit)).toBe(receipt);
    expect(mocks.wait).toHaveBeenCalledWith("0xabc");
    expect(mocks.world).toHaveBeenCalledWith("blitz");
    expect(mocks.create).toHaveBeenCalledWith({ world, gameId: 7, presetId: 2 });
    expect(mocks.connect).toHaveBeenCalledWith(signer);
    expect(ownerLookup).toHaveBeenCalledWith({ contractAddress: "0x777", entrypoint: "owner_of", calldata: ["0x123"] });
    expect(submit).toHaveBeenCalledWith(client, "0x456");
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("keeps the entry stream alive until the submitted settlement is applied", async () => {
    let applied!: () => void;
    mocks.wait.mockReturnValue(
      new Promise<void>((resolve) => {
        applied = resolve;
      }),
    );
    const settlement = submitSettlement(meta, signer, async () => ({ transaction_hash: "0xabc" }));
    await vi.waitFor(() => expect(mocks.wait).toHaveBeenCalledWith("0xabc"));
    expect(mocks.dispose).not.toHaveBeenCalled();
    applied();
    await settlement;
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("reports a terminal gameplay rejection delivered after submission", async () => {
    const rejection = new Error("settlement rejected");
    mocks.wait.mockRejectedValue(rejection);
    await expect(submitSettlement(meta, signer, async () => ({ transaction_hash: "0xabc" }))).rejects.toBe(rejection);
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("rejects a missing transaction identity before closing the stream", async () => {
    await expect(submitSettlement(meta, signer, async () => undefined)).rejects.toThrow("transaction identity");
    expect(mocks.wait).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("refuses an unbound actor before submitting and closes the entry stream", async () => {
    ownerLookup.mockResolvedValue(["0x0"]);
    const submit = vi.fn();
    await expect(submitSettlement(meta, signer, submit)).rejects.toThrow("not bound");
    expect(submit).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("preserves a terminal rejection and closes the entry stream", async () => {
    const rejection = new Error("village geometry exhausted");
    await expect(
      submitSettlement(meta, signer, async () => {
        throw rejection;
      }),
    ).rejects.toBe(rejection);
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("never substitutes another game when its directory row is missing", async () => {
    mocks.directory.mockResolvedValue({ games: [{ game_id: 8, preset_id: 2 }] });
    await expect(submitSettlement(meta, signer, vi.fn())).rejects.toThrow("absent from the world directory");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
