import { SHARED_ARMY_MODEL_PATHS } from "@/three/constants/army-constants";
import {
  SHARED_BIOME_MODEL_PATHS,
  SHARED_BUILDING_MODEL_PATHS,
  SHARED_CHEST_MODEL_PATHS,
} from "@/three/constants/scene-constants";

const buildSequentialResourceIconAssets = (start: number, endInclusive: number) =>
  Array.from({ length: endInclusive - start + 1 }, (_, index) => `/images/resources/${start + index}.png`);

const buildAvatarAssets = (total: number) =>
  Array.from({ length: total }, (_, index) => `/images/avatars/${String(index + 1).padStart(2, "0")}.png`);

export const DASHBOARD_SHARED_PLAY_FETCH_ASSETS = ["/textures/environment/models_env.hdr"] as const;

export const DASHBOARD_SHARED_PLAY_MODEL_ASSETS = Object.freeze([
  ...SHARED_ARMY_MODEL_PATHS,
  ...SHARED_BIOME_MODEL_PATHS,
  ...SHARED_BUILDING_MODEL_PATHS,
  ...SHARED_CHEST_MODEL_PATHS,
]);

export const DASHBOARD_SHARED_PLAY_IMAGE_ASSETS = Object.freeze([
  "/images/map.svg",
  "/images/icons/cursor.png",
  "/images/icons/cursor-cross.png",
  "/images/icons/grab.png",
  "/images/logos/eternum-loader.png",
  ...buildSequentialResourceIconAssets(1, 56),
  ...buildAvatarAssets(10),
  "/images/relic-chest/chest-opened.png",
  "/images/relic-chest/chest-closed.png",
  "/images/labels/army.png",
  "/images/labels/enemy_army.png",
  "/images/labels/allies_army.png",
  "/images/labels/enemy_realm.png",
  "/images/labels/enemy_village.png",
  "/images/labels/allies_realm.png",
  "/images/labels/allies_village.png",
  "/images/labels/realm.png",
  "/images/labels/village.png",
  "/images/labels/chest.png",
  "/images/labels/hyperstructure.png",
  "/images/labels/fragment_mine.png",
  "/images/labels/quest.png",
  "/images/labels/essence_rift.png",
  "/images/buildings/construction/archery.png",
  "/images/buildings/construction/barracks.png",
  "/images/buildings/construction/dragonhide.png",
  "/images/buildings/construction/farm.png",
  "/images/buildings/construction/fishing_village.png",
  "/images/buildings/construction/market.png",
  "/images/buildings/construction/mine.png",
  "/images/buildings/construction/stable.png",
  "/images/buildings/construction/storehouse.png",
  "/images/buildings/construction/workers_hut.png",
  "/images/buildings/construction/forge.png",
  "/images/buildings/construction/lumber_mill.png",
  "/images/buildings/construction/castleZero.png",
  "/images/buildings/construction/castleOne.png",
  "/images/buildings/construction/castleTwo.png",
  "/images/buildings/construction/castleThree.png",
  "/images/buildings/thumb/house.png",
  "/images/buildings/thumb/silo.png",
  "/textures/paper/worldmap-bg.png",
  "/images/textures/dark-wood.png",
  "/textures/aura2.png",
  "/image-icons/shortcuts.png",
  "/image-icons/military.png",
  "/image-icons/construction.png",
  "/image-icons/donkey.png",
  "/image-icons/resources.png",
  "/image-icons/world.png",
  "/image-icons/production.png",
  "/image-icons/home.png",
  "/image-icons/time.png",
  "/image-icons/leave.png",
  "/image-icons/portal.png",
  "/image-icons/robot.png",
  "/image-icons/hourglass.png",
  "/image-icons/transfer.png",
  "/image-icons/guild.png",
  "/image-icons/support.png",
  "/image-icons/relics.png",
  "/image-icons/latest-updates.png",
]);

export const ENTRY_ONLY_PLAY_ASSETS = Object.freeze([] as string[]);
