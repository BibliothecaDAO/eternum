import { Structure } from "@/hooks/helpers/useStructures";
import { motion } from "framer-motion";

export const EntityAvatar = ({ structure, show = true }: { structure?: Structure; show?: boolean }) => {
  const isRealm = Boolean(structure) && String(structure?.category) === "Realm";
  const isHyperstructure = Boolean(structure) && String((structure as Structure).category) === "Hyperstructure";
  const isEarthenshardsMine = Boolean(structure) && String((structure as Structure).category) === "FragmentMine";
  let imgSource = "./images/avatars/2.png";

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
    <div className="col-span-2 flex">
      {" "}
      <div
        className={`mx-auto flex flex-col gap-4 p-3 w-[${
          isRealm || isHyperstructure || isEarthenshardsMine ? 20 : 15
        }vw]`}
      >
        {displayImg && (
          <motion.img
            initial="hidden"
            animate="visible"
            variants={slideUp}
            className="w-42 h-42 clip-angled  -mt-24"
            src={imgSource}
            alt=""
          />
        )}
      </div>
    </div>
  );
};
