import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

type Registry = NativeRows["GameRegistry"];

export type GameRegistryWire = { [K in keyof Registry]: Registry[K] extends bigint ? string : Registry[K] };

export const gameRegistryRow = (overrides: Partial<GameRegistryWire> = {}): GameRegistryWire => ({
  game_id: 1,
  name: "1",
  family: nativeIdentifiers.family.FRONTIER,
  settled: false,
  dev_mode_on: false,
  start_settling_at: "1",
  start_main_at: "100",
  end_at: "1000",
  seed: "1",
  scheduled_end_at: "1000",
  clock_scale: 1,
  ...overrides,
});
