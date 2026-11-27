import "./season-one-skins.css";

import { RealmLevels } from "@bibliothecadao/types";

import { REALM_SKINS, realmSkinIcon } from "@/three/cosmetics/realm-skins";
import { Icon } from "@/ui/design-system/icon";

export const SEASON_ONE_REALM_SKINS = REALM_SKINS.filter((skin) => skin.family === "season-1");

export const SeasonOneSkins = ({ surface }: { surface: "app" | "hud" }) => {
  const iconSize = surface === "app" ? 44 : 34;
  return (
    <ul className="season-one-skins" data-season-one-skins data-surface-kind={surface}>
      {SEASON_ONE_REALM_SKINS.map((skin) => (
        <li key={skin.id} className="season-one-skins__tile" data-season-one-skin={skin.id}>
          <Icon name={realmSkinIcon(skin, RealmLevels.Kingdom)} size={iconSize} />
          <span className="season-one-skins__name">{skin.name}</span>
        </li>
      ))}
    </ul>
  );
};
