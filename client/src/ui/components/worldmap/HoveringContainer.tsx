import { DojoProvider, useDojo } from "@/hooks/context/DojoContext";
import { Html } from "@react-three/drei";
import React from "react";

type HoveringContainerProps = {
  children: React.ReactNode;
  [propName: string]: any; // Allow any other props
};

// Create a Context for the dojo object

export const HoveringContainer = ({ children, ...rest }: HoveringContainerProps) => {
  const { setup } = useDojo();
  return (
    <Html {...rest}>
      <DojoProvider value={setup}>{children}</DojoProvider>
    </Html>
  );
};
