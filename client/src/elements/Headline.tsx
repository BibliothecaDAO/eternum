import React from "react";
import { ReactComponent as HeadlineLeft } from "../assets/icons/common/headline-left.svg";
import { ReactComponent as HeadlineRight } from "../assets/icons/common/headline-right.svg";
import { ReactComponent as HeadlineBigLeft } from "../assets/icons/common/headline-big-left.svg";
import { ReactComponent as HeadlineBigRight } from "../assets/icons/common/headline-big-right.svg";
import clsx from "clsx";

type HeadlineProps = {
  children: React.ReactNode;
  className?: string;
  type?: "default" | "success" | "fail";
  size?: "small" | "big";
};

export const Headline = ({ children, className, size = "small", type }: HeadlineProps) => (
  <div className={clsx("flex items-center justify-center select-none", className)}>
    {size === "small" ? <HeadlineLeft /> : <HeadlineBigLeft className="w-full" />}
    <div className="mx-3 text-xs font-bold text-white whitespace-nowrap">{children}</div>
    {size === "small" ? <HeadlineRight /> : <HeadlineBigRight className="w-full" />}
  </div>
);
