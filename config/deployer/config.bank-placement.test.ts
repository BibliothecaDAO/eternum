import { describe, expect, mock, test } from "bun:test";
import { createBanks, nodeReadConfig, setWorldConfig } from "./config";

describe("legacy bank placement", () => {
  test("loads generated configs with neutral biome climate defaults", async () => {
    const config = await nodeReadConfig("madara", "blitz");

    expect(config.biomeClimate).toEqual({
      elevationScaleBps: 10_000,
      moistureScaleBps: 10_000,
      elevationBiasBps: 10_000,
      moistureBiasBps: 10_000,
      elevationSeed: 0,
      moistureSeed: 0,
    });
  });

  test("returns the set_world_config transaction hash", async () => {
    const setWorldConfigMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xworld-config",
    }));
    const setMercenariesNameConfigMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xmercenaries",
    }));
    const setBiomeClimateConfigMock = mock(async () => ({
      statusReceipt: "PENDING",
      transaction_hash: "0xbiome-climate",
    }));

    const transactionHash = await setWorldConfig({
      account: { address: "0xadmin" } as any,
      provider: {
        set_world_config: setWorldConfigMock,
        set_mercenaries_name_config: setMercenariesNameConfigMock,
        set_biome_climate_config: setBiomeClimateConfigMock,
      } as any,
      config: {
        biomeClimate: {
          elevationScaleBps: 10000,
          moistureScaleBps: 10000,
          elevationBiasBps: 10000,
          moistureBiasBps: 10000,
        },
      } as any,
    });

    expect(transactionHash).toBe("0xworld-config");
    expect(setWorldConfigMock).toHaveBeenCalledTimes(1);
    expect(setMercenariesNameConfigMock).toHaveBeenCalledTimes(1);
    expect(setBiomeClimateConfigMock).toHaveBeenCalledTimes(1);
    expect(setBiomeClimateConfigMock.mock.calls[0]?.[0].biome_climate_config).toEqual({
      elevation_scale_bps: 10000,
      moisture_scale_bps: 10000,
      elevation_bias_bps: 10000,
      moisture_bias_bps: 10000,
      elevation_seed: 0,
      moisture_seed: 0,
    });
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
