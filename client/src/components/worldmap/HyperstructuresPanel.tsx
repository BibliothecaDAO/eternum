import React, { useEffect, useState } from "react";
import { useSyncRealms } from "../../hooks/graphql/useGraphQLQueries";

type HyperstructuresPanelProps = {};

export const HyperstructuresPanel = ({}: HyperstructuresPanelProps) => {
  const [state, setState] = useState();

  const test = useSyncRealms();

  console.log("test", test);

  return (
    <>
      <h1>React TS FC Component</h1>
      <div>List</div>
    </>
  );
};
