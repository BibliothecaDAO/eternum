import React from "react";
type Props = {
  name: string;
  id: string | number;
  size?: number;
};

export default function ResourceIcon({ name, id, size = 50 }: Props) {
  return (
    <img
      src={`/resources/${id}.png`}
      alt={name}
      title={name}
      width={size}
      height={size}
      style={{ verticalAlign: "middle" }}
    />
  );
}
