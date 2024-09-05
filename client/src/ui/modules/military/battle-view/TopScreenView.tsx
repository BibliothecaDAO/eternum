import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";

export const TopScreenView = () => {
  const setBattleView = useUIStore((state) => state.setBattleView);

  return (
    <motion.div
      className="absolute top-0 flex w-full"
      variants={{
        hidden: { y: "-100%", opacity: 0 },
        visible: { y: "0%", opacity: 1, transition: { duration: 0.3 } },
      }}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <div className="mx-auto bg-black/80 bg-hex-bg text-gold text-2xl p-4 flex flex-col w-72 text-center rounded-b-2xl ">
        <div className="mb-4">Battle!</div>
        <Button className="bg-gold/20 text-white" onClick={() => setBattleView(null)}>
          exit battle view
        </Button>
      </div>
    </motion.div>
  );
};
