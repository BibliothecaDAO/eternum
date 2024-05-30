import { DojoProvider, useDojo } from "@/hooks/context/DojoContext";
import { Html } from "@react-three/drei";
import React from "react";

type DojoHtmlProps = {
  children: React.ReactNode;
  [propName: string]: any; // Allow any other props
};

export const DojoHtml = ({ children, ...rest }: DojoHtmlProps) => {
  const { setup } = useDojo();
  return (
    <Html {...rest} style={{ pointerEvents: "none" }}>
      <DojoProvider value={setup}>{children}</DojoProvider>
    </Html>
  );
};
