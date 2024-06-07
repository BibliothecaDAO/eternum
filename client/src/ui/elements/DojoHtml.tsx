import { DojoProvider, useDojo } from "@/hooks/context/DojoContext";
import { Html } from "@react-three/drei";
import React from "react";

type DojoHtmlProps = {
  children: React.ReactNode;
  [propName: string]: any; // Allow any other props
  pointerEvents?: "auto" | "none";
  visible?: boolean;
};

export const DojoHtml = ({ children, visible = true, ...rest }: DojoHtmlProps) => {
  const { setup } = useDojo();
  return (
    <Html visible={visible} {...rest}>
      <DojoProvider value={setup}>{children}</DojoProvider>
    </Html>
  );
};
