// @vitest-environment node

import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld, type Entity, getComponentValue } from "@dojoengine/recs";
import { describe, expect, it } from "vitest";

import { createRecsGameSyncStore } from "./gamewide-sync-adapter";

describe("Herald RECS adapter", () => {
  it("writes the ABI-decoded live-world fixture as typed RECS state", async () => {
    const worldConfigEntity = "0x0579e8877c7755365d5ec1ec7d3a94a457eff5d1f40482bbe9729c064cdead2" as Entity;
    const tileEntity = "0x037ed9fa52b5704b9b74f0893961151c91239e9c8e40ff904028b7c21705340" as Entity;
    const resourceEntity = "0x00e9c8dc40f9c88691aa427aa07c575b1cdcaaa4c21a71b00c15ee5a7c2fc95" as Entity;
    const world = createWorld();
    const components = defineContractComponents(world, "s2");
    const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, false, [
      "WorldConfig",
      "TileOpt",
      "ResourceList",
    ]);

    await store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: worldConfigEntity,
            models: {
              WorldConfig: {
                game_id: "0x1",
                map_center_offset: "0x19535c46",
                biome_climate_config: {
                  elevation_scale_bps: "0x2710",
                  moisture_scale_bps: "0x2710",
                  elevation_bias_bps: "0x2710",
                  moisture_bias_bps: "0x2710",
                  elevation_seed: "0x0",
                  moisture_seed: "0x0",
                },
                settlement_config: {
                  center: "0x7ffffffe",
                  base_distance: "0x8",
                  layers_skipped: "0x2",
                  layer_max: "0x6",
                  layer_capacity_increment: "0x6",
                  layer_capacity_bps: "0x1f40",
                  spires_layer_distance: "0x0",
                  spires_max_count: "0x0",
                  spires_settled_count: "0x0",
                },
                blitz_mode_on: true,
                blitz_settlement_config: {
                  base_distance: "0x8",
                  side: "0x0",
                  step: "0x1",
                  point: "0x1",
                  open_settlement_count: "0x0",
                  single_realm_mode: false,
                  two_player_mode: false,
                },
                blitz_hypers_settlement_config: {
                  max_ring_count: "0x4",
                  current_ring_count: "0x5",
                  point: "0x1",
                  side: "0x0",
                },
                blitz_registration_config: {
                  fee_amount: "0x0",
                  registration_count: "0x0",
                  issued_count: "0x0",
                  registration_count_max: "0x60",
                  registration_start_at: "0x6a8ddeef",
                },
                realm_count_config: { count: "0x0" },
              },
            },
          },
          {
            hashed_keys: tileEntity,
            models: {
              TileOpt: {
                game_id: "0x1",
                alt: false,
                col: "0x66aca39a",
                row: "0x66aca3d6",
                data: "0xcd594734cd5947ac0e000000004f",
              },
            },
          },
          {
            hashed_keys: resourceEntity,
            models: {
              ResourceList: {
                preset_id: "0x1",
                entity_id: "0x3e",
                index: "0x2",
                resource_type: "0x4",
                amount: "0xbebc200",
              },
            },
          },
        ],
      },
    ]);

    expect(getComponentValue(components.WorldConfig, worldConfigEntity)).toMatchObject({
      game_id: 1,
      blitz_mode_on: true,
      blitz_registration_config: {
        fee_amount: 0n,
        registration_count_max: 96,
      },
    });
    expect(getComponentValue(components.TileOpt, tileEntity)).toEqual({
      game_id: 1,
      alt: false,
      col: 1_722_590_106,
      row: 1_722_590_166,
      data: 4_164_967_312_481_933_952_144_711_738_196_047n,
    });
    expect(getComponentValue(components.ResourceList, resourceEntity)).toEqual({
      preset_id: 1,
      entity_id: 62,
      index: 2,
      resource_type: 4,
      amount: 200_000_000n,
    });
  });
});
