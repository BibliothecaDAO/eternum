import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { fragmentSpendsOpen } from "@/lab/game/shop-scenario";
import { nativeReleaseConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";

export const sellingFragments = (store: NativeFactStore) => {
  const release = store.get("GameRelease", { game_id: 1 });
  return [
    {
      model: "GameRelease",
      key: release ? store.wireKeyOf("GameRelease", release) : "0x1ab0",
      value: {
        game_id: 1,
        ...release,
        release_id: nativeReleaseConstants.SEAL_RELEASE,
        created_release_id: nativeReleaseConstants.SEAL_RELEASE,
      },
    },
    fragmentSpendsOpen(store),
  ];
};
