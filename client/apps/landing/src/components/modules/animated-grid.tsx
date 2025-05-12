import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { DataCardProps } from "./data-card";

interface GridItem<T = DataCardProps | React.ReactElement> {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  rowSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  data: T;
}

interface AnimatedGridProps<T> {
  items: GridItem<T>[];
  renderItem: (item: GridItem<T>, index: number) => React.ReactNode;
}

const getColSpanClass = (span: number | undefined, breakpoint: string) => {
  if (!span) return "";

  const classes: Record<number, string> = {
    1: `${breakpoint}:col-span-1`,
    2: `${breakpoint}:col-span-2`,
    3: `${breakpoint}:col-span-3`,
    4: `${breakpoint}:col-span-4`,
    5: `${breakpoint}:col-span-5`,
    6: `${breakpoint}:col-span-6`,
    7: `${breakpoint}:col-span-7`,
    8: `${breakpoint}:col-span-8`,
    9: `${breakpoint}:col-span-9`,
    10: `${breakpoint}:col-span-10`,
    11: `${breakpoint}:col-span-11`,
    12: `${breakpoint}:col-span-12`,
  };

  return classes[span] || "";
};

const getRowSpanClass = (span: number | undefined, breakpoint: string) => {
  if (!span) return "";

  return `${breakpoint}:row-span-${span}`;
};

export const AnimatedGrid = <T,>({ items, renderItem }: AnimatedGridProps<T>) => {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-12 gap-8 px-2"
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
          className={cn(
            getColSpanClass(item.colSpan?.sm, "sm"),
            getColSpanClass(item.colSpan?.md, "md"),
            getColSpanClass(item.colSpan?.lg, "lg"),
            getColSpanClass(item.colSpan?.xl, "xl"),
            getRowSpanClass(item.rowSpan?.sm, "sm"),
            getRowSpanClass(item.rowSpan?.md, "md"),
            getRowSpanClass(item.rowSpan?.lg, "lg"),
            getRowSpanClass(item.rowSpan?.xl, "xl"),
          )}
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
