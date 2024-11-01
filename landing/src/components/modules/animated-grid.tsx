import { motion } from "framer-motion";
interface AnimatedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
}

export const AnimatedGrid = <T,>({ items, renderItem }: AnimatedGridProps<T>) => {
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
      {items.map((item, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.5 }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  );
};
