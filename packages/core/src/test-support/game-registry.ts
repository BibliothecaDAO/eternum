import { FRONTIER_FIXTURE_PRESET_ID } from "../../../../config/source/common/native-preset-modes";
import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

type Registry = NativeRows["GameRegistry"];

export type GameRegistryWire = { [K in keyof Registry]: Registry[K] extends bigint ? string : Registry[K] };

export const gameRegistryRow = (overrides: Partial<GameRegistryWire> = {}): GameRegistryWire => ({
  game_id: 1,
  name: "1",
  family: nativeIdentifiers.family.FRONTIER,
  preset_id: FRONTIER_FIXTURE_PRESET_ID,
  settled: false,
  ready: true,
  dev_mode_on: false,
  start_settling_at: "1",
  start_main_at: "100",
  end_at: "1000",
  end_grace_seconds: 0,
  seed: "1",
  scheduled_end_at: "1000",
  ...overrides,
});
