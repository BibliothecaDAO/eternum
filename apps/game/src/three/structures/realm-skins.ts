import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { shortString } from "starknet";
import assets from "./realm-assets.json";

import REALM_SKINS from "./realm-skins.json";

export { REALM_SKINS };
const DEVCON_CAMPAIGN = BigInt(shortString.encodeShortString("devcon-2026"));
export type RealmSkin = keyof typeof REALM_SKINS;
export const DEVCON_BANNER_ART = "/textures/realms/devcon-diamond.png";
export const REALM_SKIN_MODELS = Object.entries(REALM_SKINS).flatMap(([skin, { directory }]) =>
  assets
    .filter((asset) => !asset.wonder)
    .map(({ id, level }) => ({
      skin: skin as RealmSkin,
      level,
      path: `/models/realms/devcon/${directory}/${id}.glb`,
      cosmeticId: `structure:realm:${skin}:${id}`,
    })),
);

/** The contract marks golden campaign homes with tier 2. */
export const isGoldenHome = (home: Pick<NativeRows["CampaignHome"], "tier"> | null | undefined): boolean =>
  home?.tier === 2;

/** CampaignHome is the founding identity, independent of the current holder and game mode. */
export function realmSkinOf(
  home: { campaign_id: bigint | string; tier: number } | null | undefined,
): RealmSkin | undefined {
  if (!home || BigInt(home.campaign_id) !== DEVCON_CAMPAIGN) return undefined;
  if (home.tier === 1) return "devcon";
  if (isGoldenHome(home)) return "devcon-golden";
  throw new Error(`Unknown Devcon home tier ${home.tier}`);
}

export function readRealmSkin(
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
): RealmSkin | undefined {
  return realmSkinOf(store.get("CampaignHome", { game_id: realm.game_id, home: realm.entity_id }));
}

export function realmSkinModel(skin: RealmSkin, level: number) {
  const model = REALM_SKIN_MODELS.find((model) => model.skin === skin && model.level === level);
  if (!model) throw new Error(`Unknown ${skin} realm level ${level}`);
  return model;
}

export function isRealmSkinPath(path: string): boolean {
  return REALM_SKIN_MODELS.some((model) => model.path === path);
}

export function realmSkinIcon(skin: RealmSkin): IconMeaning {
  return REALM_SKINS[skin].icon as IconMeaning;
}
