import { useDojo } from "@/hooks/context/DojoContext";
import { Structure } from "@/hooks/helpers/useStructures";
import { ID, RealmLevels } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { motion } from "framer-motion";

export const EntityAvatar = ({
  structure,
  address = "0x01",
  show = true,
}: {
  structure?: Structure;
  show?: boolean;
  address?: string;
}) => {
  const getStructureCategory = (s?: Structure) => s?.category?.toString();
  const isCategory = (category: string, s?: Structure) => getStructureCategory(s) === category;

  const isRealm = isCategory("Realm", structure);
  const isHyperstructure = isCategory("Hyperstructure", structure);
  const isFragmentMine = isCategory("FragmentMine", structure);
  const isMercenary = structure?.isMercenary;

  const randomAvatarIndex = ((parseInt(address.slice(0, 8), 16) % 7) + 1).toString().padStart(2, "0");
  let imgSource = `./images/avatars/${randomAvatarIndex}.png`;

  if (isMercenary) {
    imgSource = "./images/avatars/mercenary.png";
  } else if (isRealm) {
    imgSource = getRealmImgFromEntityId(structure?.entity_id);
  } else if (isHyperstructure) {
    imgSource = "./images/buildings/thumb/hyperstructure.png";
  } else if (isFragmentMine) {
    imgSource = "./images/buildings/thumb/fragment-mine.png";
  }

  const displayImg = structure || show;

  return (
    <div className="mb-4 w-44 min-w-44">
      {displayImg && (
        <motion.img
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { y: "100%" },
            visible: { y: "0%", transition: { duration: 0.6 } },
          }}
          className="h-56 w-56 rounded-full object-cover border-gold/10 border-2 -mt-12 bg-brown"
          src={imgSource}
          alt=""
        />
      )}
    </div>
  );
};

const getRealmImgFromEntityId = (realmEntityId: ID | undefined) => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  if (realmEntityId) {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));

    switch (realm?.level) {
      case RealmLevels.City - 1:
        return "./images/buildings/thumb/castleOne.png";
      case RealmLevels.Kingdom - 1:
        return "./images/buildings/thumb/castleTwo.png";
      case RealmLevels.Empire - 1:
        return "./images/buildings/thumb/castleThree.png";
    }
  }
  return "./images/buildings/thumb/castleZero.png";
};
