import { Html } from "@react-three/drei";
import React from "react";

type HoveringContainerProps = {
  children: React.ReactNode;
  [propName: string]: any; // Allow any other props
};

// Create a Context for the dojo object

export const HoveringContainer = ({ children, ...rest }: HoveringContainerProps) => {
  return <Html {...rest}>{children}</Html>;
};
