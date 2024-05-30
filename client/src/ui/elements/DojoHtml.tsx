import { DojoProvider, useDojo } from "@/hooks/context/DojoContext";
import { Html } from "@react-three/drei";
import React from "react";

type DojoHtmlProps = {
  children: React.ReactNode;
  [propName: string]: any; // Allow any other props
  pointerEvents?: "auto" | "none";
};

export const DojoHtml = ({ children, ...rest }: DojoHtmlProps) => {
  const { setup } = useDojo();
  return (
    <Html {...rest}>
      <DojoProvider value={setup}>{children}</DojoProvider>
    </Html>
  );
};
