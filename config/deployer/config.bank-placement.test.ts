import { describe, expect, mock, test } from "bun:test";
import { createBanks, setWorldConfig } from "./config";

describe("legacy bank placement", () => {
  test("returns the set_world_config transaction hash", async () => {
    const setWorldConfigMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xworld-config",
    }));
    const setMercenariesNameConfigMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xmercenaries",
    }));

    const transactionHash = await setWorldConfig({
      account: { address: "0xadmin" } as any,
      provider: {
        set_world_config: setWorldConfigMock,
        set_mercenaries_name_config: setMercenariesNameConfigMock,
      } as any,
      config: {} as any,
    });

    expect(transactionHash).toBe("0xworld-config");
    expect(setWorldConfigMock).toHaveBeenCalledTimes(1);
    expect(setMercenariesNameConfigMock).toHaveBeenCalledTimes(1);
  });

  test("uses the world config tx hash to place banks around the shifted center", async () => {
    const createBanksMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xbanks",
    }));

    await createBanks(
      {
        account: { address: "0xadmin" } as any,
        provider: {
          create_banks: createBanksMock,
        } as any,
        config: {
          banks: {
            maxNumBanks: 6,
            name: "Central Bank",
          },
        } as any,
      },
      "0x39",
    );

    expect(createBanksMock).toHaveBeenCalledTimes(1);
    expect(createBanksMock.mock.calls[0]?.[0].banks[0]).toEqual({
      name: "Central Bank 1",
      coord: {
        alt: false,
        x: 2147483911,
        y: 2147483596,
      },
    });
  });
});
