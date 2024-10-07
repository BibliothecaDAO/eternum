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
    <Html {...rest} style={{ opacity: visible ? 1 : 0 }}>
      <DojoProvider value={setup}>{children}</DojoProvider>
    </Html>
  );
};
