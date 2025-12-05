import type { HTMLAttributes } from "react";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type DivProps = HTMLAttributes<HTMLDivElement>;

type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

export const Card = ({ className, ...props }: DivProps) => (
  <div
    {...props}
    className={cx("rounded-lg border border-white/10 bg-black/40 p-4 text-white", className)}
  />
);

export const CardHeader = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("mb-2", className)} />
);

export const CardTitle = ({ className, ...props }: HeadingProps) => (
  <h3 {...props} className={cx("text-lg font-semibold", className)} />
);

export const CardContent = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col gap-2", className)} />
);

export const CardDescription = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("text-sm text-white/70", className)} />
);

export const Container = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col w-full", className)} />
);

export const HStack = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex items-center", className)} />
);

export const VStack = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col", className)} />
);

export const ScrollArea = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("overflow-y-auto", className)} />
);
