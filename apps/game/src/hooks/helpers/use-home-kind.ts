import { useGame } from "@/hooks/context/game-context";
import { readRealmSkin } from "@/three/structures/realm-skins";
import { homeKind } from "@/ui/design-system/home-icons";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useNativeRevision } from "./use-native-facts";

export function useHomeKind(realm: NativeRows["Structure"] | null) {
  const { setup } = useGame();
  useNativeRevision(["CampaignHome"]);
  return realm ? homeKind(readRealmSkin(setup.store, realm), realm.metadata.has_wonder) : "realm";
}
