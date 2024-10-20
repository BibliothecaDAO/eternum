import { motion } from "framer-motion";
import { SeasonPass } from "./season-pass";

const seasonPasses = [
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
  {
    title: "l'unpik",
    description: "1000 Lords",
  },
];

export const SeasonPassRow = () => {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {seasonPasses.map((seasonPass, index) => (
        <motion.div
          key={`${seasonPass.title}-${index}`}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.5 }}
        >
          <SeasonPass {...seasonPass} />
        </motion.div>
      ))}
    </motion.div>
  );
};
