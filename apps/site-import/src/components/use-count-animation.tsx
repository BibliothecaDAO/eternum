import { useState, useEffect, useRef } from "react";

export function useCountAnimation(end: number, duration: number = 2) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    let frameId = 0;

    const animate = (now: number) => {
      if (startTime.current === null) {
        startTime.current = now;
      }

      const progress = Math.min(
        (now - startTime.current) / (duration * 1000),
        1
      );

      if (progress < 1) {
        nodeRef.current = Math.floor(end * progress);
        setCount(nodeRef.current);
        frameId = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      nodeRef.current = 0;
      startTime.current = null;
      cancelAnimationFrame(frameId);
    };
  }, [end, duration]);

  return count;
}
