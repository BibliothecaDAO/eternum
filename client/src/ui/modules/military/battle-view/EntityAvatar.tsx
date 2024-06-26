import { Structure } from "@/hooks/helpers/useStructures";
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
  const isRealm = Boolean(structure) && String(structure?.category) === "Realm";
  const isHyperstructure = Boolean(structure) && String((structure as Structure).category) === "Hyperstructure";
  const isEarthenshardsMine = Boolean(structure) && String((structure as Structure).category) === "FragmentMine";

  const randomAvatarIndex = (parseInt(address.slice(0, 8), 16) % 7) + 1;
  let imgSource = `./images/avatars/${randomAvatarIndex}.png`;

  if (isRealm) {
    imgSource = "./images/buildings/thumb/castle.png";
  } else if (isHyperstructure) {
    imgSource = "./images/buildings/thumb/hyperstructure.png";
  } else if (isEarthenshardsMine) {
    imgSource = "./images/buildings/thumb/earthenshard-mine.png";
  }

  const displayImg = structure || show;
  const slideUp = {
    hidden: { y: "100%" },
    visible: { y: "0%", transition: { duration: 0.6 } },
  };
  return (
    <div className="mb-4">
      {displayImg && (
        <motion.img
          initial="hidden"
          animate="visible"
          variants={slideUp}
          className="w-44 min-w-44 h-44 clip-angled rounded-full object-cover  border-gold/50 border-4 -mt-12 bg-black"
          src={imgSource}
          alt=""
        />
      )}
    </div>
  );
};
