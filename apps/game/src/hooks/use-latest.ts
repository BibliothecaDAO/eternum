import { useLayoutEffect, useRef } from "react";

/**
 * The value as of the last render, for an effect that runs on its own trigger (opening, a key, a handshake) and reads
 * what is current then, without running again each time the value changes. Set before any effect of the same commit.
 */
export const useLatest = <T>(value: T): { readonly current: T } => {
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });
  return latest;
};
